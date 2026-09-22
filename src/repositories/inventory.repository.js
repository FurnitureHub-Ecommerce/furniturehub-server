const Inventory = require("../models/Inventory.model");

// Đọc tồn kho theo lô, không tạo hoặc cập nhật Inventory khi khách xem hàng.
const findByVariantIds = (variantIds) => {
  return Inventory.find({ variantId: { $in: variantIds } })
    .select("variantId quantity")
    .lean();
};

/**
 * Mục đích: trừ kho cho từng variant trong đơn hàng khi xác nhận Order.
 * Đầu vào: mảng deductions = [{ variantId, quantity }] đã được gộp theo variantId.
 *
 * Bước 1: Đọc tồn kho hiện tại của tất cả variant bằng một query lean.
 * Bước 2: So sánh từng variant với số lượng cần trừ.
 *         - Inventory không tồn tại → thiếu hàng.
 *         - quantity < cần trừ → thiếu hàng.
 *         Gom tất cả variant thiếu hàng thay vì dừng sớm để báo đầy đủ.
 * Bước 3: Nếu có bất kỳ variant thiếu hàng → ném lỗi 409, không trừ gì cả.
 * Bước 4: Dùng bulkWrite với updateOne có điều kiện { quantity: { $gte: qty } }
 *         để trừ kho atomic từng document. Điều kiện $gte ngăn tồn kho âm kể cả
 *         khi có request đồng thời thay đổi Inventory giữa Bước 1 và Bước 4.
 * Bước 5: Đếm số document thực sự được cập nhật. Nếu nhỏ hơn số cần → race condition
 *         đã làm ít nhất một variant thiếu hàng; ném lỗi 409 để caller rollback trạng thái Order.
 *
 * Không dùng transaction vì môi trường standalone không hỗ trợ multi-document transaction.
 * Caller (order.service.js) phải chịu trách nhiệm không gọi hàm này hai lần cho cùng một Order.
 */
const deductStockForOrder = async (deductions) => {
  if (!deductions || deductions.length === 0) return;

  const variantIds = deductions.map((d) => d.variantId);

  // Bước 1: Đọc tồn kho hiện tại để kiểm tra trước khi trừ.
  const inventories = await findByVariantIds(variantIds);
  const stockMap = new Map(inventories.map((inv) => [inv.variantId.toString(), inv.quantity]));

  // Bước 2–3: Kiểm tra tất cả variant trước khi trừ bất kỳ cái nào.
  const insufficient = deductions.filter((d) => {
    const available = stockMap.get(d.variantId.toString());
    // Inventory không tồn tại hoặc số lượng không đủ → thiếu hàng.
    return available === undefined || available < d.quantity;
  });

  if (insufficient.length > 0) {
    const error = new Error(
      `Insufficient stock for variant(s): ${insufficient.map((d) => d.variantId).join(", ")}`
    );
    error.statusCode = 409;
    error.details = insufficient.map((d) => ({
      variantId: d.variantId.toString(),
      requested: d.quantity,
      available: stockMap.get(d.variantId.toString()) ?? 0,
    }));
    throw error;
  }

  // Bước 4: Trừ kho atomic từng document bằng điều kiện $gte để ngăn tồn kho âm.
  const bulkOps = deductions.map((d) => ({
    updateOne: {
      filter: { variantId: d.variantId, quantity: { $gte: d.quantity } },
      update: { $inc: { quantity: -d.quantity } },
    },
  }));

  const result = await Inventory.bulkWrite(bulkOps, { ordered: false });

  // Bước 5: Kiểm tra race condition — số document cập nhật phải bằng số deduction.
  if (result.modifiedCount < deductions.length) {
    const error = new Error(
      "Insufficient stock detected during concurrent update. Please retry confirming the order."
    );
    error.statusCode = 409;
    throw error;
  }
};

/**
 * Mục đích: hoàn lại số lượng tồn kho khi confirmOrder bị race condition (không update được Order).
 * Đầu vào: mảng deductions = [{ variantId, quantity }]
 */
const restoreStockForOrder = async (deductions) => {
  if (!deductions || deductions.length === 0) return;

  const bulkOps = deductions.map((d) => ({
    updateOne: {
      filter: { variantId: d.variantId },
      update: { $inc: { quantity: d.quantity } },
    },
  }));

  await Inventory.bulkWrite(bulkOps, { ordered: false });
};

module.exports = { findByVariantIds, deductStockForOrder, restoreStockForOrder };
