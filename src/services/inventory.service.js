const mongoose = require("mongoose");
const inventoryRepository = require("../repositories/inventory.repository");
const {
  variantIdSchema,
  stockMovementSchema,
  stockAdjustmentSchema,
  stockThresholdSchema,
  inventoryQuerySchema,
  transactionQuerySchema,
} = require("../validators/inventory.validator");

const makeError = (message, statusCode) => Object.assign(new Error(message), { statusCode });

const parse = (schema, value) => {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw Object.assign(makeError("Validation failed", 400), { errors: result.error.issues });
  }
  return result.data;
};

const requireVariant = async (variantId, session = null) => {
  parse(variantIdSchema, variantId);
  if (!await inventoryRepository.variantExists(variantId, session)) {
    throw makeError("Product variant not found", 404);
  }
};

const pagination = (page, limit, totalItems) => ({
  page, limit, totalItems, totalPages: Math.ceil(totalItems / limit),
});

const getAll = async (query = {}, lowStock = false) => {
  const { page, limit, variantId, sku } = parse(inventoryQuerySchema, query);
  const filter = variantId ? { variantId } : {};
  if (sku) {
    const variant = await inventoryRepository.findVariantBySku(sku);
    if (!variant || (variantId && variant._id.toString() !== variantId.toLowerCase())) {
      return { inventories: [], pagination: pagination(page, limit, 0) };
    }
    filter.variantId = variant._id;
  }
  if (lowStock) filter.$expr = { $lte: ["$quantity", "$lowStockThreshold"] };
  const { inventories, totalItems } = await inventoryRepository.findAll(filter, { page, limit });
  return { inventories, pagination: pagination(page, limit, totalItems) };
};

const getByVariantId = async (variantId) => {
  await requireVariant(variantId);
  const inventory = await inventoryRepository.findByVariantId(variantId, { populate: true });
  if (!inventory) throw makeError("Inventory not found", 404);
  return inventory;
};

/**
 * Tra cứu StockTransaction để quản lý kho đối chiếu số lượng trước/sau và người thực hiện.
 * Chỉ dùng các query đã qua Zod; kết hợp variant, type và thời gian theo điều kiện đồng thời.
 * Variant hợp lệ về định dạng nhưng chưa có lịch sử trả danh sách rỗng, không tạo Inventory.
 * Giữ phân trang chung của kho; không cập nhật quantity hoặc tạo giao dịch trong API đọc.
 */
const getTransactions = async (query = {}) => {
  const { page, limit, variantId, type, from, to } = parse(transactionQuerySchema, query);
  const filter = {};
  if (variantId) filter.variantId = variantId;
  if (type) filter.type = type;
  if (from || to) {
    filter.createdAt = {
      ...(from && { $gte: new Date(from) }),
      ...(to && { $lte: new Date(to) }),
    };
  }
  const { transactions, totalItems } = await inventoryRepository.findTransactions(filter, { page, limit });
  return { transactions, pagination: pagination(page, limit, totalItems) };
};

/**
 * Nhập/xuất/kiểm kê dùng chung luồng để số lượng và lịch sử luôn khớp nhau.
 * Người thao tác phải có định danh hợp lệ từ JWT; không nhận người thực hiện từ body.
 * Zod kiểm tra số lượng trước truy vấn: nhập/xuất nguyên dương, kiểm kê nguyên không âm.
 * Trong transaction, kiểm tra variant rồi đọc tồn kho; SKU vẫn thuộc ProductVariant.
 * Theo luồng hiện có, nhập/kiểm kê đầu tiên khởi tạo Inventory; xuất khi chưa có kho trả 404.
 * Mỗi thao tác ghi một StockTransaction; lỗi trước commit hủy cả thay đổi kho và lịch sử.
 */
const changeStock = async (variantId, data, userId, type) => {
  if (!mongoose.isObjectIdOrHexString(userId)) throw makeError("Unauthorized", 401);
  parse(variantIdSchema, variantId);
  const { quantity, note } = parse(type === "ADJUSTMENT" ? stockAdjustmentSchema : stockMovementSchema, data);

  try {
    await inventoryRepository.initialize();
    // Số lượng và lịch sử phải được lưu cùng nhau; không ghi riêng lẻ khi thiếu transaction.
    return await mongoose.connection.transaction(async (session) => {
      await requireVariant(variantId, session);
      const existing = await inventoryRepository.findByVariantId(variantId, { session });
      if (!existing && type === "EXPORT") throw makeError("Inventory not found", 404);

      const beforeQuantity = existing ? existing.quantity : 0;
      if (!Number.isSafeInteger(beforeQuantity) || beforeQuantity < 0) {
        throw makeError("Inventory quantity is invalid; repair the existing record first", 409);
      }
      if (type === "EXPORT" && quantity > beforeQuantity) {
        throw makeError(`Insufficient stock. Available: ${beforeQuantity}, Requested: ${quantity}`, 400);
      }
      // Kiểm kê đặt số thực tế mới, không cộng thêm; nhập cộng và xuất trừ lượng yêu cầu.
      const afterQuantity = type === "ADJUSTMENT" ? quantity
        : beforeQuantity + (type === "IMPORT" ? quantity : -quantity);
      if (!Number.isSafeInteger(afterQuantity)) {
        throw makeError("Resulting quantity exceeds the safe integer limit", 400);
      }

      // Khớp tồn đã đọc để tránh ghi đè thao tác đồng thời; transaction có thể đọc lại và thử lại.
      const inventory = existing
        ? await inventoryRepository.setQuantity(variantId, beforeQuantity, afterQuantity, session)
        : await inventoryRepository.createInventory(variantId, afterQuantity, session);
      if (!inventory) throw makeError("Inventory changed concurrently; please retry", 409);

      // Lịch sử lưu độ lớn chênh lệch; kiểm kê không đổi vẫn ghi quantity=0 để lưu dấu lần kiểm kê.
      const transaction = await inventoryRepository.createTransaction({
        inventoryId: inventory._id,
        variantId,
        type,
        quantity: Math.abs(afterQuantity - beforeQuantity),
        beforeQuantity,
        afterQuantity,
        createdBy: userId,
        ...(note !== undefined && { note }),
      }, session);
      return { inventory, transaction };
    }, {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
    });
  } catch (error) {
    if (error.code === 20 && /Transaction numbers are only allowed/.test(error.message)) {
      throw makeError("Stock changes require MongoDB replica set or Atlas transactions", 503);
    }
    if (error.code === 11000) {
      throw makeError("Inventory or transaction conflict; check stock transaction indexes and retry", 409);
    }
    throw error;
  }
};

const updateThreshold = async (variantId, data) => {
  const { lowStockThreshold } = parse(stockThresholdSchema, data);
  await requireVariant(variantId);
  const inventory = await inventoryRepository.setThreshold(variantId, lowStockThreshold);
  if (!inventory) throw makeError("Inventory not found", 404);
  return inventory;
};

module.exports = {
  getAll,
  getByVariantId,
  getTransactions,
  importStock: (variantId, data, userId) => changeStock(variantId, data, userId, "IMPORT"),
  exportStock: (variantId, data, userId) => changeStock(variantId, data, userId, "EXPORT"),
  adjustStock: (variantId, data, userId) => changeStock(variantId, data, userId, "ADJUSTMENT"),
  updateThreshold,
};
