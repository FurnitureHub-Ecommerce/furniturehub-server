/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Tầng Repository quản lý truy vấn và cập nhật tồn kho (Inventory) và ghi nhận
 * lịch sử biến động (StockTransaction) cho từng ProductVariant.
 *
 * Nghiệp vụ chính:
 * 1. findByVariantIds: Đọc tồn kho hàng loạt theo danh sách variantIds.
 * 2. deductStockForOrder: Kiểm tra tồn kho, trừ kho atomic và ghi StockTransaction (DEDUCTION).
 * 3. restoreStockForOrder: Hoàn lại tồn kho atomic và ghi StockTransaction (RESTORE).
 * 4. hasDeductionTransaction / hasRestoreTransaction: Kiểm tra bằng chứng trừ/hoàn kho.
 */

const Inventory = require("../models/Inventory.model");
const StockTransaction = require("../models/StockTransaction.model");
const ProductVariant = require("../models/ProductVariant.model");

// Chờ tạo collection và unique index trên database mới trước khi thay đổi tồn kho.
const initialize = () => Promise.all([Inventory.init(), StockTransaction.init()]);

const variantPopulation = {
  path: "variantId",
  select: "sku productId color size material isActive",
  populate: { path: "productId", select: "name isActive" },
};

const findAll = async (filter, { page, limit }) => {
  const [inventories, totalItems] = await Promise.all([
    Inventory.find(filter).select("-__v").populate(variantPopulation)
      .sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Inventory.countDocuments(filter),
  ]);
  return { inventories, totalItems };
};

const findByVariantId = (variantId, { session = null, populate = false } = {}) => {
  const query = Inventory.findOne({ variantId }).select("-__v");
  if (session) query.session(session);
  if (populate) query.populate(variantPopulation);
  return query.lean();
};

const variantExists = (variantId, session = null) => {
  const query = ProductVariant.exists({ _id: variantId });
  if (session) query.session(session);
  return query;
};

const findVariantBySku = (sku) => ProductVariant.findOne({ sku }).select("_id").lean();

const createInventory = async (variantId, quantity, session) => {
  const [inventory] = await Inventory.create([{ variantId, quantity }], { session });
  return inventory.toObject({ versionKey: false });
};

// Khớp số lượng đã đọc để tránh ghi đè thay đổi tồn kho từ luồng đơn hàng.
const setQuantity = (variantId, beforeQuantity, quantity, session) =>
  Inventory.findOneAndUpdate(
    { variantId, quantity: beforeQuantity },
    { $set: { quantity } },
    { returnDocument: "after", runValidators: true, session }
  ).select("-__v").lean();

const setThreshold = (variantId, lowStockThreshold) =>
  Inventory.findOneAndUpdate(
    { variantId },
    { $set: { lowStockThreshold } },
    { returnDocument: "after", runValidators: true }
  ).select("-__v").lean();

const createTransaction = async (data, session) => {
  const [transaction] = await StockTransaction.create([data], { session });
  return transaction.toObject({ versionKey: false });
};

/**
 * Đọc lịch sử và đếm tổng bằng cùng filter để trả phân trang theo convention hiện tại.
 * Lấy SKU/thuộc tính từ ProductVariant, tên sản phẩm từ Product; không sao chép SKU vào kho.
 * createdBy chỉ lấy _id và fullName, không lấy password, email hay thông tin User khác.
 * Sắp xếp createdAt giảm dần; _id giảm dần giữ thứ tự xác định khi nhiều giao dịch cùng thời điểm.
 * skip/limit chỉ lấy trang cần xem; lean trả dữ liệu đọc, không lưu hoặc tạo bản ghi nào.
 */
const findTransactions = async (filter, { page, limit }) => {
  const [transactions, totalItems] = await Promise.all([
    StockTransaction.find(filter).select("-__v").populate(variantPopulation)
      .populate("createdBy", "fullName")
      .sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    StockTransaction.countDocuments(filter),
  ]);
  return { transactions, totalItems };
};

/**
 * Đọc tồn kho theo danh sách variantIds.
 */
const findByVariantIds = (variantIds, session = null) => {
  const query = Inventory.find({ variantId: { $in: variantIds } });
  if (session) query.session(session);
  return query.select("_id variantId quantity").lean();
};

/**
 * Kiểm tra xem Order đã có bản ghi trừ kho (DEDUCTION) hay chưa.
 */
const hasDeductionTransaction = async (orderId, session = null) => {
  const query = StockTransaction.exists({ orderId, type: "DEDUCTION" });
  if (session) query.session(session);
  return query;
};

/**
 * Kiểm tra xem Order đã có bản ghi hoàn kho (RESTORE) hay chưa (ngăn hoàn 2 lần).
 */
const hasRestoreTransaction = async (orderId, session = null) => {
  const query = StockTransaction.exists({ orderId, type: "RESTORE" });
  if (session) query.session(session);
  return query;
};

/**
 * Lấy danh sách các giao dịch trừ kho của một Order để hoàn kho chính xác.
 */
const getDeductionsByOrderId = async (orderId, session = null) => {
  const query = StockTransaction.find({ orderId, type: "DEDUCTION" });
  if (session) query.session(session);
  return query.lean();
};

const makeStockError = (message, statusCode) => Object.assign(new Error(message), { statusCode });

/**
 * Kiểm tra toàn bộ variant và Inventory trong cùng ảnh chụp dữ liệu của transaction.
 * Thiếu tham chiếu trả 404; không tự tạo Inventory để che mất dữ liệu đã trừ trước đó.
 */
const getOrderInventories = async (variantIds, session) => {
  const variants = await ProductVariant.find({ _id: { $in: variantIds } }).select("_id").session(session).lean();
  const existingIds = new Set(variants.map((variant) => variant._id.toString()));
  const missingVariants = variantIds.filter((id) => !existingIds.has(id.toString()));
  if (missingVariants.length > 0) {
    throw makeStockError(`Product variant not found: ${missingVariants.join(", ")}`, 404);
  }
  const inventories = await findByVariantIds(variantIds, session);
  const inventoryMap = new Map(inventories.map((inventory) => [inventory.variantId.toString(), inventory]));
  const missingInventories = variantIds.filter((id) => !inventoryMap.has(id.toString()));
  if (missingInventories.length > 0) {
    throw makeStockError(`Inventory not found for variant(s): ${missingInventories.join(", ")}`, 404);
  }
  return inventoryMap;
};

/**
 * Trừ/hoàn kho đơn hàng luôn cần transaction đang hoạt động do Order Service cung cấp.
 * Kiểm tra đủ tất cả dòng trước bulkWrite; điều kiện quantity đã đọc bảo vệ số trước/sau.
 * Nếu thiếu một cập nhật hoặc ghi lịch sử lỗi, ném lỗi để rollback toàn bộ transaction.
 */
const changeStockForOrder = async (movements, orderId, userId, session, type) => {
  if (!session?.inTransaction()) throw makeStockError("Stock changes require an active MongoDB transaction", 503);
  if (!orderId || !userId || !Array.isArray(movements) || movements.length === 0 ||
      movements.some((item) => !item.variantId || !Number.isSafeInteger(item.quantity) || item.quantity <= 0)) {
    throw makeStockError("Invalid order stock movement", 400);
  }
  const variantIds = movements.map((item) => item.variantId.toString().toLowerCase());
  if (new Set(variantIds).size !== variantIds.length) throw makeStockError("Order quantities must be grouped by variant", 400);
  const inventoryMap = await getOrderInventories(variantIds, session);
  const direction = type === "DEDUCTION" ? -1 : 1;

  const changes = movements.map((item, index) => {
    const variantId = variantIds[index];
    const inventory = inventoryMap.get(variantId);
    if (!Number.isSafeInteger(inventory.quantity) || inventory.quantity < 0) {
      throw makeStockError(`Invalid inventory quantity for variant: ${variantId}`, 409);
    }
    if (direction === -1 && inventory.quantity < item.quantity) {
      throw makeStockError(`Insufficient stock for variant ${variantId}. Available: ${inventory.quantity}, Requested: ${item.quantity}`, 400);
    }
    const afterQuantity = inventory.quantity + direction * item.quantity;
    if (!Number.isSafeInteger(afterQuantity) || afterQuantity < 0) {
      throw makeStockError(`Resulting inventory quantity is invalid for variant: ${variantId}`, 409);
    }
    return { variantId, quantity: item.quantity, inventory, afterQuantity };
  });

  // Chỉ ghi sau khi mọi dòng đã qua kiểm tra; $gte ngăn trừ âm ngay tại database.
  const operations = changes.map(({ inventory, quantity }) => ({
    updateOne: {
      filter: {
        _id: inventory._id,
        quantity: { $eq: inventory.quantity, ...(direction === -1 && { $gte: quantity }) },
      },
      update: { $inc: { quantity: direction * quantity } },
    },
  }));
  const result = await Inventory.bulkWrite(operations, { session, ordered: true });
  if (result.modifiedCount !== changes.length) {
    throw makeStockError("Inventory changed concurrently; retry the order status change", 409);
  }

  // Unique index theo orderId/variantId/type ngăn ghi cùng giao dịch lần hai.
  // Lỗi trùng lịch sử cũng rollback số lượng đã cập nhật, không cần cộng/trừ bù.
  await StockTransaction.insertMany(changes.map(({ variantId, quantity, inventory, afterQuantity }) => ({
    inventoryId: inventory._id,
    variantId,
    orderId,
    type,
    quantity,
    beforeQuantity: inventory.quantity,
    afterQuantity,
    createdBy: userId,
    note: type === "DEDUCTION" ? `Xuất kho cho Order #${orderId}` : `Hoàn kho cho Order #${orderId}`,
  })), { session, ordered: true });
};

// Chỉ gọi khi đơn lần đầu chuyển pending → confirmed.
const deductStockForOrder = (deductions, orderId, userId, session) =>
  changeStockForOrder(deductions, orderId, userId, session, "DEDUCTION");

// Chỉ gọi khi đơn confirmed chuyển rejected/cancelled, theo đúng lịch sử đã trừ.
const restoreStockForOrder = (restorations, orderId, userId, session) =>
  changeStockForOrder(restorations, orderId, userId, session, "RESTORE");

module.exports = {
  initialize,
  findAll,
  findByVariantId,
  variantExists,
  findVariantBySku,
  createInventory,
  setQuantity,
  setThreshold,
  createTransaction,
  findTransactions,
  findByVariantIds,
  hasDeductionTransaction,
  hasRestoreTransaction,
  getDeductionsByOrderId,
  deductStockForOrder,
  restoreStockForOrder,
};
