/**
 * @Author: Minh Truong
 * Mục đích: kiểm thử HTTP Order bằng node:test với JWT/Zod/Mongoose/populate thật.
 * Thay đọc/ghi collection bằng bản sao BSON; không truy cập dữ liệu ứng dụng.
 * Kiểm tra snapshot, quyền sở hữu, giá/tồn kho, ranh giới ghi và lỗi xác nhận ghi.
 * Mô phỏng không chứng minh atomicity MongoDB; bộ order.integration.test.js dùng DB thật.
 */
const { test, before, after, beforeEach, afterEach, mock } = require("node:test");
const assert = require("node:assert/strict");
const { randomBytes } = require("node:crypto");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const app = require("../src/app");
const { swaggerSpec } = require("../src/config/swagger");
const Order = require("../src/models/Order.model");
const Cart = require("../src/models/Cart.model");
const Address = require("../src/models/Address.model");
const Product = require("../src/models/Product.model");
const ProductVariant = require("../src/models/ProductVariant.model");
const Inventory = require("../src/models/Inventory.model");
const { serialize, deserialize } = mongoose.mongo.BSON;
const clone = (value) => deserialize(serialize({ value })).value;
const oid = (suffix) => new mongoose.Types.ObjectId(suffix.padStart(24, "0"));
const ids = {
  customer: oid("1"), otherCustomer: oid("2"), address: oid("3"), otherAddress: oid("4"),
  cart: oid("5"), item: oid("6"), variant: oid("7"), product: oid("8"), missing: oid("9"), secondItem: oid("a"),
};
let database, reads, writes, server, baseUrl, customerToken, otherToken;
let baseline;
const previousSecret = process.env.JWT_SECRET;

/**
 * Tạo dữ liệu hai khách độc lập; địa chỉ không mặc định vẫn phải đặt hàng được.
 * Hai dòng cùng Variant kiểm tra đủ item và tổng số lượng; giá Cart khác giá bán.
 */
const createDatabase = () => ({
  Address: [
    { _id: ids.address, userId: ids.customer, receiverName: "Customer A", phone: "0912345678", addressLine: "123 Lê Lợi", ward: "Bến Thành", city: "Hồ Chí Minh", isDefault: false },
    { _id: ids.otherAddress, userId: ids.otherCustomer, receiverName: "Customer B", phone: "0987654321", addressLine: "456 Nguyễn Huệ", ward: "Sài Gòn", city: "Hồ Chí Minh" },
  ],
  Cart: [{ _id: ids.cart, userId: ids.customer, items: [
    { _id: ids.item, variantId: ids.variant, quantity: 2, unitPrice: 100 },
    { _id: ids.secondItem, variantId: ids.variant, quantity: 1, unitPrice: 200 },
  ] }],
  Product: [{ _id: ids.product, name: "Ghế thử nghiệm", isActive: true }],
  ProductVariant: [{ _id: ids.variant, productId: ids.product, sku: "CHAIR-TEST", color: "Nâu", size: "M", material: "Gỗ", price: 1000000, isActive: true }],
  Inventory: [{ _id: oid("b"), variantId: ids.variant, quantity: 10 }],
  Order: [],
});

const matches = (doc, filter) => Object.entries(filter).every(([field, value]) =>
  value && Array.isArray(value.$in)
    ? value.$in.some((id) => String(doc[field]) === String(id))
    : String(doc[field]) === String(value));

/**
 * Chỉ giả lập collection để Mongoose vẫn cast query, populate và validate save.
 * Mỗi insertOne lưu bản sao của toàn bộ Order; chặn ghi Cart/Address/Inventory.
 * Chặn transaction để phát hiện vô tình phụ thuộc replica set trên standalone.
 */
const installMocks = () => {
  for (const model of [Address, Cart, Product, ProductVariant, Inventory, Order]) {
    const read = (filter) => {
      reads.push({ model: model.modelName, filter: clone(filter) });
      return database[model.modelName].filter((doc) => matches(doc, filter)).map(clone);
    };
    mock.method(model.collection, "findOne", async (filter) => read(filter)[0] || null);
    mock.method(model.collection, "find", (filter) => ({ toArray: async () => read(filter) }));
    for (const method of ["insertOne", "insertMany", "updateOne", "updateMany", "replaceOne", "deleteOne", "deleteMany", "findOneAndUpdate", "findOneAndDelete", "bulkWrite"]) {
      mock.method(model.collection, method, () => {
        assert.fail(`Không được gọi ${model.modelName}.${method}`);
      });
    }
  }
  mock.method(Order.collection, "insertOne", async (doc, options) => {
    writes.push({ doc: clone(doc), options: clone(options) });
    database.Order.push(clone(doc));
    return { acknowledged: true, insertedId: doc._id };
  });
  mock.method(mongoose, "startSession", () => assert.fail("Không được yêu cầu transaction"));
  mock.method(mongoose.connection, "transaction", () => assert.fail("Không được yêu cầu transaction"));
};

before(async () => {
  process.env.JWT_SECRET = randomBytes(32).toString("hex");
  customerToken = jwt.sign({ userId: String(ids.customer), role: "CUSTOMER" }, process.env.JWT_SECRET);
  otherToken = jwt.sign({ userId: String(ids.otherCustomer), role: "CUSTOMER" }, process.env.JWT_SECRET);
  await new Promise((resolve, reject) => {
    server = app.listen(0, "127.0.0.1", resolve);
    server.once("error", reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
beforeEach(() => {
  database = createDatabase();
  reads = [];
  writes = [];
  baseline = null;
  installMocks();
});
afterEach(() => {
  mock.restoreAll();
  if (baseline) {
    for (const model of ["Address", "Cart", "Product", "ProductVariant", "Inventory"]) {
      assert.deepEqual(database[model], baseline[model], `Order không được ghi ${model}`);
    }
  }
});
after(async () => {
  if (previousSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousSecret;
  if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

/**
 * Gửi HTTP thật đến app với token/body tùy chọn; chụp nguồn trước mỗi request.
 * afterEach xác nhận API chỉ có thể ghi Order, không làm thay đổi dữ liệu nguồn.
 */
const request = async (method, path, body, token = customerToken) => {
  baseline = clone(database);
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: await response.json() };
};
const create = (body = { addressId: String(ids.address) }, token = customerToken) => request("POST", "/api/orders", body, token);
const detail = (id, token = customerToken, query = "") => request("GET", `/api/orders/${id}${query}`, undefined, token);
const assertRejected = (response, status, code) => {
  assert.equal(response.status, status);
  if (code) assert.ok(response.body.errors.some((error) => error.code === code));
  assert.equal(database.Order.length, 0);
  assert.equal(writes.length, 0);
};

test("TC01–06/28: lưu đủ snapshot/giá/tổng tiền/pending trong một insert đã xác nhận", async () => {
  const response = await create();
  assert.equal(response.status, 201);
  assert.equal(response.body.message, "Order created successfully");
  const order = response.body.order;
  assert.equal(order.status, "pending");
  assert.equal(order.userId, String(ids.customer));
  assert.equal(order.subtotal, 3000000);
  assert.equal(order.totalAmount, 3000000);
  assert.equal(order.items.length, 2);
  assert.deepEqual(order.items.map((item) => item.unitPrice), [1000000, 1000000]);
  assert.deepEqual(order.items.map((item) => item.itemSubtotal), [2000000, 1000000]);
  assert.ok(order.items.every((item) => item._id && item.variantId === String(ids.variant)));
  assert.deepEqual(order.shippingAddress, {
    receiverName: "Customer A", phone: "0912345678", addressLine: "123 Lê Lợi", ward: "Bến Thành", city: "Hồ Chí Minh",
  });
  assert.ok(order.createdAt && order.updatedAt);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].options.writeConcern.w, "majority");
  assert.equal(database.Order[0].items.length, 2);
  assert.equal(reads.filter((read) => read.model === "Inventory").length, 1);
  assert.equal(String(reads.find((read) => read.model === "Address").filter.userId), String(ids.customer));
  assert.equal(String(reads.find((read) => read.model === "Cart").filter.userId), String(ids.customer));
});

test("TC07/08: thiếu hoặc rỗng Cart không tạo đơn", async () => {
  database.Cart = [];
  assertRejected(await create(), 400);
  database.Cart = [{ _id: ids.cart, userId: ids.customer, items: [] }];
  assertRejected(await create(), 400);
});

test("TC09/10: địa chỉ thiếu và của người khác cùng trả 404", async () => {
  const missing = await create({ addressId: String(ids.missing) });
  const foreign = await create({ addressId: String(ids.otherAddress) });
  assertRejected(missing, 404);
  assert.deepEqual(foreign, missing);
});

test("TC11/16: Zod từ chối body sai và mọi trường do client tự chỉ định", async () => {
  for (const body of [{}, null, [], { addressId: 123 }, { addressId: "invalid" }]) {
    assertRejected(await create(body), 400);
  }
  for (const field of ["userId", "cartId", "unitPrice", "subtotal", "totalAmount", "inventoryQuantity", "orderStatus", "status", "items", "paymentMethod"]) {
    assertRejected(await create({ addressId: String(ids.address), [field]: "fake" }), 400);
  }
  assert.equal(reads.length, 0);
});

test("TC12/13: thiếu hoặc ngừng bán Variant/Product từ chối toàn bộ đơn", async () => {
  for (const [model, code] of [["ProductVariant", "VARIANT"], ["Product", "PRODUCT"]]) {
    const original = clone(database[model]);
    database[model] = [];
    assertRejected(await create(), 400, `${code}_NOT_FOUND`);
    database[model] = clone(original);
    database[model][0].isActive = false;
    assertRejected(await create(), 400, `${code}_INACTIVE`);
    database[model] = original;
  }
  baseline = clone(database);
});

test("TC14/29: gộp số lượng dòng trùng Variant; một dòng lỗi không tạo đơn một phần", async () => {
  database.Inventory[0].quantity = 2;
  const response = await create();
  assertRejected(response, 400, "INSUFFICIENT_STOCK");
  assert.equal(response.body.totalAmount, null);
  assert.ok(response.body.items.every((item) => item.requestedQuantity === 3 && item.availableStock === 2));
});

test("Từ chối mọi kiểu số lượng sai, dòng null và Inventory lỗi", async () => {
  for (const quantity of [0, -1, 1.5, "2", null, Number.MAX_SAFE_INTEGER + 1]) {
    database.Cart[0].items[1].quantity = quantity;
    assertRejected(await create(), 400, "INVALID_QUANTITY");
  }
  database.Cart[0].items[1] = null;
  assertRejected(await create(), 400, "VARIANT_NOT_FOUND");
  database.Cart = createDatabase().Cart;
  for (const quantity of [-1, 0.5, "10", null]) {
    database.Inventory[0].quantity = quantity;
    assertRejected(await create(), 400, "INVALID_STOCK");
  }
  database.Inventory = [];
  assertRejected(await create(), 400, "INVENTORY_NOT_FOUND");
});

test("TC15: tạo đơn đọc lại giá/tồn kho sau lần validate Checkout trước đó", async () => {
  const preview = await request("POST", "/api/checkout/validate", { addressId: String(ids.address) });
  assert.equal(preview.body.totalAmount, 3000000);
  database.ProductVariant[0].price = 1200000;
  const response = await create();
  assert.equal(response.status, 201);
  assert.equal(response.body.order.totalAmount, 3600000);
  assert.equal(response.body.order.items[0].unitPrice, 1200000);
  database.Inventory[0].quantity = 0;
  assert.equal((await create()).status, 400);
  assert.equal(database.Order.length, 1);
});

test("Từ chối giá sai và tiền vượt giới hạn, không lưu đơn", async () => {
  for (const price of [-1, null, "100", Infinity, NaN, Number.MAX_SAFE_INTEGER + 1]) {
    database.ProductVariant[0].price = price;
    assertRejected(await create(), 400, "INVALID_PRICE");
  }
  database.ProductVariant[0].price = Number.MAX_SAFE_INTEGER;
  assertRejected(await create(), 400, "INVALID_ITEM_TOTAL");
});

test("Lưu giá bằng 0 và giá thập phân chính xác theo Task 3", async () => {
  database.ProductVariant[0].price = 0.1;
  const response = await create();
  assert.equal(response.body.order.totalAmount, 0.3);
  assert.equal(response.body.order.items[0].itemSubtotal, 0.2);
  database.ProductVariant[0].price = 0;
  assert.equal((await create()).body.order.totalAmount, 0);
});

test("TC17–19: hai endpoint đều yêu cầu JWT hợp lệ và role CUSTOMER", async () => {
  for (const token of [null, "invalid-token", jwt.sign({ userId: String(ids.customer), role: "CUSTOMER" }, "wrong-key")]) {
    assertRejected(await create(undefined, token), 401);
    assert.equal((await detail(ids.missing, token)).status, 401);
  }
  for (const role of ["STAFF", "ADMIN", "STORAGE_MANAGER"]) {
    const token = jwt.sign({ userId: String(ids.customer), role }, process.env.JWT_SECRET);
    assertRejected(await create(undefined, token), 403);
    assert.equal((await detail(ids.missing, token)).status, 403);
  }
  assert.equal(reads.length, 0);
});

test("TC20/21: chỉ chủ đơn xem được, query userId không thay được chủ sở hữu", async () => {
  const created = await create();
  reads = [];
  const response = await detail(created.body.order._id, customerToken, `?userId=${ids.otherCustomer}`);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.order.items, created.body.order.items);
  assert.equal(reads.length, 1);
  assert.equal(reads[0].model, "Order");
  assert.deepEqual(reads[0].filter, { _id: new mongoose.Types.ObjectId(created.body.order._id), userId: ids.customer });
  assert.equal((await detail(created.body.order._id, otherToken, `?userId=${ids.customer}`)).status, 404);
  assert.equal(response.body.order.password, undefined);
});

test("TC22/23: ID sai trả 400 trước đọc DB, đơn thiếu trả 404", async () => {
  assert.equal((await detail("invalid-id")).status, 400);
  assert.equal(reads.length, 0);
  assert.equal((await detail(ids.missing)).status, 404);
});

test("TC24–26: sửa/xóa địa chỉ, Variant và Product không thay lịch sử", async () => {
  const created = (await create()).body.order;
  database.Address[0].addressLine = "Địa chỉ mới";
  database.Address[0].phone = "0999999999";
  database.ProductVariant[0].price = 1200000;
  database.ProductVariant[0].sku = "CHANGED";
  database.Product[0].name = "Tên mới";
  let response = await detail(created._id);
  assert.deepEqual(response.body.order.shippingAddress, created.shippingAddress);
  assert.deepEqual(response.body.order.items, created.items);
  assert.equal(response.body.order.totalAmount, created.totalAmount);
  database.Address = [];
  database.ProductVariant = [];
  database.Product = [];
  reads = [];
  response = await detail(created._id);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.order.shippingAddress, created.shippingAddress);
  assert.deepEqual(response.body.order.items, created.items);
  assert.deepEqual(reads.map((read) => read.model), ["Order"]);
});

test("TC27: validate subdocument cuối thất bại thì chưa ghi Order", async () => {
  const stockPriceService = require("../src/services/stockPrice.service");
  const calculate = stockPriceService.calculateStockPrice;
  mock.method(stockPriceService, "calculateStockPrice", async (...args) => {
    const result = await calculate(...args);
    result.items[1].quantity = 0;
    return result;
  });
  assertRejected(await create(), 500);
});

test("Schema chặn Order không có items, item null/thiếu giá và địa chỉ thiếu trường", async () => {
  await create();
  const valid = writes[0].doc;
  for (const items of [[], [null], [{ variantId: ids.variant, quantity: 1 }], [valid.items[0], { ...valid.items[1], quantity: 1.5 }]]) {
    await assert.rejects(new Order({ ...valid, items }).validate(), { name: "ValidationError" });
  }
  await assert.rejects(new Order({ ...valid, shippingAddress: { receiverName: "A" } }).validate(), { name: "ValidationError" });
});

test("TC27: insert thất bại trả 500 chung, không lưu dữ liệu một phần", async () => {
  mock.method(Order.collection, "insertOne", async () => { throw new Error("private database failure"); });
  const response = await create();
  assertRejected(response, 500);
  assert.deepEqual(response.body, { message: "Internal server error" });
});

test("Không trả 201 trước khi insert được xác nhận", async () => {
  const insert = Order.collection.insertOne;
  let release, notifyStarted;
  const gate = new Promise((resolve) => { release = resolve; });
  const started = new Promise((resolve) => { notifyStarted = resolve; });
  mock.method(Order.collection, "insertOne", async (...args) => {
    notifyStarted();
    await gate;
    return insert(...args);
  });
  let settled = false;
  const pending = create().then((result) => { settled = true; return result; });
  await started;
  try {
    assert.equal(settled, false);
    assert.equal(database.Order.length, 0);
  } finally { release(); }
  assert.equal((await pending).status, 201);
  assert.equal(database.Order[0].items.length, 2);
});

test("Mất xác nhận sau khi ghi: trả 500, có thể còn một đơn đầy đủ, không retry/xóa bù", async () => {
  const insert = Order.collection.insertOne;
  mock.method(Order.collection, "insertOne", async (...args) => {
    await insert(...args);
    throw new Error("Lost acknowledgement");
  });
  assert.equal((await create()).status, 500);
  assert.equal(writes.length, 1);
  assert.equal(database.Order.length, 1);
  assert.equal(database.Order[0].items.length, 2);
});

test("Lỗi đọc Address/Inventory/Order trả 500 và không lộ nội dung database", async () => {
  for (const model of [Address, Inventory, Order]) {
    const original = model.collection.findOne;
    mock.method(model.collection, "findOne", async () => { throw new Error("private database failure"); });
    const response = model === Order ? await detail(ids.missing) : await create();
    assertRejected(response, 500);
    assert.deepEqual(response.body, { message: "Internal server error" });
    mock.method(model.collection, "findOne", original);
  }
});

test("TC30: gửi hai request đồng thời hiện tạo hai đơn đầy đủ, chưa chống duplicate", async () => {
  const responses = await Promise.all([create(), create()]);
  assert.deepEqual(responses.map((response) => response.status), [201, 201]);
  assert.notEqual(responses[0].body.order._id, responses[1].body.order._id);
  assert.equal(database.Order.length, 2);
  assert.ok(database.Order.every((order) => order.items.length === 2));
});

test("Swagger khai báo đủ hai API, Bearer, schemas và status theo triển khai", async () => {
  const response = await fetch(`${baseUrl}/api-docs/`);
  assert.equal(response.status, 200);
  for (const [path, method, success] of [["/api/orders", "post", "201"], ["/api/orders/{id}", "get", "200"]]) {
    const operation = swaggerSpec.paths[path][method];
    assert.deepEqual(operation.security, [{ bearerAuth: [] }]);
    assert.deepEqual(Object.keys(operation.responses).sort(), [success, "400", "401", "403", "404", "500"].sort());
  }
  assert.equal(swaggerSpec.components.schemas.CreateOrderInput.additionalProperties, false);
  assert.equal(swaggerSpec.components.schemas.Order.properties.items.minItems, 1);
  assert.ok(swaggerSpec.paths["/api/checkout/validate"]);
  assert.ok(swaggerSpec.paths["/api/cart"]);
});
