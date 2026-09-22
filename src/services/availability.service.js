const inventoryRepository = require("../repositories/inventory.repository");
const variantRepository = require("../repositories/productVariant.repository");

const toObject = (document) =>
  typeof document.toObject === "function" ? document.toObject() : document;

// null = chưa xác định tồn kho; 0 = đã xác định hết hàng.
const withVariantStock = async (variants) => {
  if (variants.length === 0) return [];

  const inventories = await inventoryRepository.findByVariantIds(
    variants.map((variant) => variant._id)
  );
  const stockByVariant = new Map(inventories.map((inventory) => [
    inventory.variantId.toString(),
    Number.isSafeInteger(inventory.quantity) && inventory.quantity >= 0
      ? inventory.quantity
      : null,
  ]));

  return variants.map((variant) => ({
    ...toObject(variant),
    availableStock: stockByVariant.get(variant._id.toString()) ?? null,
  }));
};

// Chỉ cộng biến thể đang hoạt động; lấy dữ liệu theo lô cho cả trang sản phẩm.
const withProductStock = async (products) => {
  if (products.length === 0) return [];

  const variants = await variantRepository.findByProductIds(
    products.map((product) => product._id),
    { isActive: true }
  );
  const variantsWithStock = await withVariantStock(variants);
  const stockByProduct = new Map();

  for (const variant of variantsWithStock) {
    const productId = variant.productId.toString();
    const previous = stockByProduct.has(productId)
      ? stockByProduct.get(productId)
      : 0;
    const total = previous === null || variant.availableStock === null
      ? null
      : previous + variant.availableStock;
    stockByProduct.set(productId, Number.isSafeInteger(total) ? total : null);
  }

  return products.map((product) => ({
    ...toObject(product),
    availableStock: stockByProduct.has(product._id.toString())
      ? stockByProduct.get(product._id.toString())
      : 0,
  }));
};

module.exports = { withVariantStock, withProductStock };
