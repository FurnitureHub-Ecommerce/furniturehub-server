const { test, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const Product = require("../src/models/productModel");
const Variant = require("../src/models/productVariantModel");
const Cart = require("../src/models/cartModel");
const Order = require("../src/models/orderModel");
const productRepository = require("../src/repositories/productRepository");
const variantRepository = require("../src/repositories/productVariantRepository");
const cartRepository = require("../src/repositories/cartRepository");
const inventoryRepository = require("../src/repositories/inventoryRepository");
const productService = require("../src/services/productService");
const variantService = require("../src/services/productVariantService");
const cartService = require("../src/services/cartService");
const checkoutService = require("../src/services/checkoutService");
const orderService = require("../src/services/orderService");
const addressService = require("../src/services/addressService");
const { updateVariantSchema } = require("../src/validators/productVariantValidator");

const ids = {
  product: "507f1f77bcf86cd799439001",
  a: "507f1f77bcf86cd799439002",
  b: "507f1f77bcf86cd799439003",
  user: "507f1f77bcf86cd799439004",
  item: "507f1f77bcf86cd799439005",
  address: "507f1f77bcf86cd799439006",
};
let product, variants, cart, writes;

// Isolated service tests: real schemas/documents, in-memory repository boundaries.
// No database connection or production data is used.
beforeEach(() => {
  product = new Product({ _id: ids.product, name: "Chair", isActive: true });
  variants = [
    new Variant({ _id: ids.a, productId: ids.product, sku: "A", color: "red", price: 100, isActive: true }),
    new Variant({ _id: ids.b, productId: ids.product, sku: "B", color: "blue", price: 200, isActive: true }),
  ];
  cart = new Cart({ userId: ids.user, items: [
    { _id: ids.item, variantId: ids.a, quantity: 1, unitPrice: 90 },
  ] });
  writes = { product: [], variant: [], cart: 0, order: 0 };
  mock.method(productRepository, "findById", async () => product);
  mock.method(productRepository, "findAll", async (filter) =>
    product && (filter.isActive === undefined || product.isActive === filter.isActive) ? [product] : []);
  mock.method(productRepository, "update", async (id, data) => {
    writes.product.push({ id, data });
    product.set(data);
    return product;
  });
  mock.method(variantRepository, "findById", async (id) =>
    variants.find((variant) => variant.id === id.toString()) || null);
  mock.method(variantRepository, "findByProductId", async (id, filter = {}) =>
    variants.filter((variant) => variant.productId.toString() === id.toString() &&
      (filter.isActive === undefined || variant.isActive === filter.isActive)));
  mock.method(variantRepository, "findByProductIds", async (productIds, filter = {}) =>
    variants.filter((variant) => productIds.some((id) => id.toString() === variant.productId.toString()) &&
      (filter.isActive === undefined || variant.isActive === filter.isActive)));
  mock.method(variantRepository, "update", async (id, data) => {
    writes.variant.push({ id, data });
    const variant = variants.find((entry) => entry.id === id);
    variant.set(data);
    return variant;
  });
  mock.method(inventoryRepository, "findByVariantIds", async (variantIds) =>
    variantIds.map((variantId) => ({ variantId, quantity: 10 })));
  mock.method(cartRepository, "findInventoryByVariantId", async () => ({ quantity: 10 }));
  mock.method(cartRepository, "findOrCreate", async () => cart);
  mock.method(cartRepository, "findByUserId", async () => cart);
  mock.method(cartRepository, "save", async () => { writes.cart += 1; return cart; });
  mock.method(addressService, "getAddressById", async () => ({
    receiverName: "Customer", phone: "0901234567", addressLine: "1 Main St", ward: "Ward 1", city: "HCM",
  }));
  mock.method(Order.prototype, "save", async function () { writes.order += 1; return this; });
});

afterEach(() => mock.restoreAll());

const populatedCart = () => ({ items: [{
  _id: ids.item, quantity: 1, unitPrice: 90,
  variantId: variants[0] ? { ...variants[0].toObject(), productId: product?.toObject() ?? null } : null,
}] });

for (const [productActive, variantActive] of [[true, true], [true, false], [false, true], [false, false]]) {
  const label = `Product=${productActive}, Variant=${variantActive}`;
  const usable = productActive && variantActive;

  test(`public Variant detail/list enforce both states: ${label}`, async () => {
    product.isActive = productActive;
    variants[0].isActive = variantActive;
    if (usable) {
      assert.equal((await variantService.getById(ids.a)).isActive, true);
    } else {
      await assert.rejects(variantService.getById(ids.a), { statusCode: variantActive ? 400 : 404 });
    }
    if (productActive) {
      const result = await variantService.getByProductId(ids.product);
      assert.equal(result.some((variant) => variant._id.toString() === ids.a), usable);
    } else {
      await assert.rejects(variantService.getByProductId(ids.product), { statusCode: 400 });
    }
    assert.equal(variants[0].isActive, variantActive);
    assert.equal(writes.variant.length, 0);
  });

  test(`add/update Cart enforce both states: ${label}`, async () => {
    product.isActive = productActive;
    variants[0].isActive = variantActive;
    if (usable) {
      await cartService.addItem(ids.user, ids.a, 1);
      assert.equal(cart.items[0].quantity, 2);
      await cartService.updateItem(ids.user, ids.item, 3);
      assert.equal(cart.items[0].quantity, 3);
      assert.equal(cart.items[0].unitPrice, 90);
      assert.equal(writes.cart, 2);
    } else {
      await assert.rejects(cartService.addItem(ids.user, ids.a, 1), { statusCode: 404 });
      await assert.rejects(cartService.updateItem(ids.user, ids.item, 2), { statusCode: 404 });
      assert.equal(cart.items[0].quantity, 1);
      assert.equal(writes.cart, 0);
    }
    assert.equal(variants[0].isActive, variantActive);
  });

  test(`Checkout/Create Order enforce both states: ${label}`, async () => {
    product.isActive = productActive;
    variants[0].isActive = variantActive;
    mock.method(cartRepository, "findByUserId", async () => populatedCart());
    const result = await checkoutService.validateCheckout(ids.user, ids.address);
    assert.equal(result.valid, usable);
    assert.equal(result.items[0].valid, usable);
    assert.equal(result.totalAmount, usable ? 100 : null);
    if (usable) {
      const order = await orderService.createOrder(ids.user, ids.address);
      assert.equal(order.totalAmount, 100);
      assert.equal(writes.order, 1);
    } else {
      if (!productActive) assert.ok(result.errors.some((error) => error.code === "PRODUCT_INACTIVE"));
      if (!variantActive) assert.ok(result.errors.some((error) => error.code === "VARIANT_INACTIVE"));
      await assert.rejects(orderService.createOrder(ids.user, ids.address), { statusCode: 400 });
      assert.equal(writes.order, 0);
    }
    assert.equal(writes.cart, 0);
    assert.equal(variants[0].isActive, variantActive);
  });
}

for (const deactivate of ["delete", "patch"]) {
  test(`D/E: ${deactivate} Product then reactivate preserves individually disabled A and active B`, async () => {
    await variantService.remove(ids.a);
    if (deactivate === "delete") await productService.remove(ids.product);
    else await productService.update(ids.product, { isActive: false });
    assert.equal(product.isActive, false);
    assert.deepEqual(variants.map((variant) => variant.isActive), [false, true]);
    const adminVariants = await variantService.getByProductId(ids.product, true);
    assert.deepEqual(adminVariants.map((variant) => variant.isActive), [false, true]);
    assert.equal((await productService.getAll(true))[0].isActive, false);
    await assert.rejects(variantService.getById(ids.b), { statusCode: 400 });

    await productService.update(ids.product, { isActive: true });
    assert.equal(product.isActive, true);
    assert.deepEqual(variants.map((variant) => variant.isActive), [false, true]);
    await assert.rejects(variantService.getById(ids.a), { statusCode: 404 });
    assert.equal((await variantService.getById(ids.b)).isActive, true);
    assert.deepEqual(writes.product.map((write) => write.data), [{ isActive: false }, { isActive: true }]);
    assert.deepEqual(writes.variant, [{ id: ids.a, data: { isActive: false } }]);
  });
}

test("Admin can toggle only Variant status under an inactive Product without enabling its parent or siblings", async () => {
  product.isActive = false;
  for (const isActive of [false, true]) {
    const data = updateVariantSchema.parse({ isActive });
    assert.equal((await variantService.update(ids.a, data)).isActive, isActive);
    assert.equal(product.isActive, false);
    assert.equal(variants[1].isActive, true);
    await assert.rejects(variantService.getById(ids.a), { statusCode: isActive ? 400 : 404 });
  }
  assert.equal(writes.product.length, 0);
});

test("Inactive Product still blocks Variant creation, attribute edits and mixed status/attribute edits", async () => {
  product.isActive = false;
  await assert.rejects(variantService.create(ids.product, { sku: "C", price: 300 }), { statusCode: 400 });
  for (const data of [{ price: 250 }, { price: 250, isActive: true }]) {
    await assert.rejects(variantService.update(ids.a, data), { statusCode: 400 });
  }
  assert.equal(writes.variant.length, 0);
});

test("Variant status update still requires an existing Product", async () => {
  product = null;
  await assert.rejects(variantService.update(ids.a, { isActive: true }), { statusCode: 404 });
  assert.equal(writes.variant.length, 0);
});

for (const missing of ["product", "variant"]) {
  test(`Cart mutations and Checkout/Create Order reject missing ${missing}`, async () => {
    if (missing === "product") product = null;
    else variants = [];
    await assert.rejects(cartService.addItem(ids.user, ids.a, 1), { statusCode: 404 });
    await assert.rejects(cartService.updateItem(ids.user, ids.item, 2), { statusCode: 404 });
    mock.method(cartRepository, "findByUserId", async () => populatedCart());
    const result = await checkoutService.validateCheckout(ids.user, ids.address);
    assert.equal(result.valid, false);
    assert.ok(result.errors.some((error) => error.code === `${missing.toUpperCase()}_NOT_FOUND`));
    await assert.rejects(orderService.createOrder(ids.user, ids.address), { statusCode: 400 });
    assert.equal(writes.cart, 0);
    assert.equal(writes.order, 0);
  });
}

test("Cart update still rejects insufficient stock without changing quantity or snapshot price", async () => {
  await assert.rejects(cartService.updateItem(ids.user, ids.item, 11), { statusCode: 400 });
  assert.equal(cart.items[0].quantity, 1);
  assert.equal(cart.items[0].unitPrice, 90);
  assert.equal(writes.cart, 0);
});

test("An unavailable Cart item can still be removed", async () => {
  product.isActive = false;
  variants[0].isActive = false;
  await cartService.removeItem(ids.user, ids.item);
  assert.equal(cart.items.length, 0);
  assert.equal(writes.cart, 1);
});

test("Product public detail/list hide inactive parents; active detail stock excludes disabled variants", async () => {
  variants[0].isActive = false;
  assert.equal((await productService.getById(ids.product)).availableStock, 10);
  assert.equal((await productService.getAll()).length, 1);
  product.isActive = false;
  await assert.rejects(productService.getById(ids.product), { statusCode: 404 });
  assert.equal((await productService.getAll()).length, 0);
  assert.equal((await productService.getById(ids.product, true)).isActive, false);
});

test("Catalog search/price filter pipeline requires active Product and active Variant", async () => {
  // Inspect the actual repository aggregation; execution against MongoDB is not mocked as a claim of integration coverage.
  const aggregate = mock.method(Product, "aggregate", async () => [{ products: [], metadata: [] }]);
  const result = await productService.getCatalog({ search: "Chair", minPrice: "50", maxPrice: "150" });
  assert.deepEqual(result.products, []);
  const pipeline = aggregate.mock.calls[0].arguments[0];
  assert.equal(pipeline[0].$match.isActive, true);
  assert.equal(pipeline[0].$match.name.$regex, "Chair");
  const lookup = pipeline.find((stage) => stage.$lookup?.from === "productvariants").$lookup;
  assert.deepEqual(lookup.pipeline[0].$match.$expr.$and, [
    { $eq: ["$productId", "$$productId"] }, { $eq: ["$isActive", true] },
  ]);
  assert.deepEqual(pipeline.find((stage) => stage.$match?.variants).$match.variants,
    { $elemMatch: { price: { $gte: 50, $lte: 150 } } });
});
