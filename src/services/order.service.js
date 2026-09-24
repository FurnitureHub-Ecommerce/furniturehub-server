/**
 * @Author: Minh Truong
 * Mục đích: tạo, đọc đơn của Customer và kiểm soát yêu cầu đổi trạng thái.
 * Tái sử dụng Address Service, Cart Repository và kiểm tra Checkout/Task 3.
 * Tạo đơn lưu một document; đổi trạng thái dùng transaction cùng Inventory và lịch sử.
 */
const mongoose = require("mongoose");
const Order = require("../models/Order.model");
const addressService = require("./address.service");
const cartRepository = require("../repositories/cart.repository");
const checkoutService = require("./checkout.service");
const inventoryRepository = require("../repositories/inventory.repository");
const { orderIdSchema } = require("../validators/order.validator");
const { ORDER_STATUSES, ORDER_STATUS_TRANSITIONS } = require("../constants/orderStatus");
const Payment = require("../models/Payment.model");
const ROLES = require("../constants/roles");

/**
 * Đầu vào: userId từ JWT và addressId đã qua Zod.
 * Bước 1: Đọc Address theo _id/userId; địa chỉ thiếu hoặc của người khác trả 404.
 * Bước 2: Đọc Cart của Customer theo userId, populate Variant/Product và giữ kiểu gốc.
 * Bước 3: Dùng validateCart kiểm tra toàn bộ dòng, tổng quantity theo Variant,
 * Inventory.quantity và ProductVariant.price mới nhất tại lần đọc này.
 * Cart, số lượng, trạng thái, giá hoặc tồn kho lỗi trả 400 giống Checkout;
 * kết quả chẩn đoán có itemId/variantId và totalAmount=null, không tạo đơn một phần.
 * Bước 4: Sao chép năm trường địa chỉ và mỗi dòng giá đã tính, không dùng giá Cart.
 * Lưu thêm tên/SKU/thuộc tính để vẫn xem được sau khi Product/Variant bị sửa hoặc xóa.
 * Bước 5: Validate và lưu Order với status pending cùng mọi item trong một insert.
 * Chờ xác nhận ghi majority trước khi trả document đã lưu; lỗi ghi chuyển thành 500.
 * Mất kết nối lúc chờ xác nhận có thể đã lưu đủ đơn: không tự ghi lại hoặc xóa bù.
 * Không xóa Cart, trừ/giữ Inventory hoặc tạo Payment; không chống gửi trùng request.
 * Kiểm tra tồn kho không ngăn overselling vì không có nghiệp vụ giữ hàng.
 */
const createOrder = async (userId, addressId) => {
  const address = await addressService.getAddressById(userId, addressId);
  const cart = await cartRepository.findByUserId(userId, { lean: true });
  const result = await checkoutService.validateCart(cart);
  if (!result.valid) {
    const error = new Error(result.message);
    error.statusCode = 400;
    error.details = result;
    throw error;
  }

  const order = new Order({
    userId,
    status: "pending",
    shippingAddress: {
      receiverName: address.receiverName,
      phone: address.phone,
      addressLine: address.addressLine,
      ward: address.ward,
      city: address.city,
    },
    items: result.items.map((item, index) => {
      const variant = cart.items[index].variantId;
      return {
        variantId: item.variantId,
        productName: variant.productId.name,
        sku: variant.sku,
        color: variant.color,
        size: variant.size,
        material: variant.material,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        itemSubtotal: item.itemSubtotal,
      };
    }),
    subtotal: result.totalAmount,
    totalAmount: result.totalAmount,
  });

  await order.save({ writeConcern: { w: "majority" } });
  return order.toObject({ versionKey: false });
};

/**
 * Đầu vào: userId từ JWT và orderId từ URL, không dùng userId từ body/query.
 * Bước 1: Validate ID bằng Zod, sai định dạng trả 400 trước truy vấn.
 * Bước 2: Query cả _id và userId; không tìm thấy hoặc khác chủ đều trả 404.
 * Bước 3: Trả document đã lưu gồm địa chỉ, items, giá/tổng tiền và timestamps.
 * Không populate Address/ProductVariant/User hoặc tính lại tiền của đơn cũ.
 * Vì item nằm trong Order, một query đọc đầy đủ lịch sử kể cả tham chiếu đã bị xóa.
 * Lỗi database chuyển lên Controller trả 500, không lộ chi tiết nội bộ.
 */
const getOrderById = async (userId, orderId) => {
  if (!orderIdSchema.safeParse(orderId).success) {
    const error = new Error("Invalid order ID");
    error.statusCode = 400;
    throw error;
  }

  const order = await Order.findOne({ _id: orderId, userId }).select("-__v").lean();
  if (!order) {
    const error = new Error("Order not found");
    error.statusCode = 404;
    throw error;
  }
  return order;
};

const makeError = (message, statusCode) => Object.assign(new Error(message), { statusCode });

const validateOrderId = (orderId) => {
  if (!orderIdSchema.safeParse(orderId).success) throw makeError("Invalid order ID", 400);
};

// Quyền ở route được kiểm tra lại khi service được gọi trực tiếp; người thao tác lấy từ JWT.
const validateActor = (user, allowedRoles) => {
  if (!user || !mongoose.isObjectIdOrHexString(user.userId)) throw makeError("Unauthorized", 401);
  if (!allowedRoles.includes(user.role)) throw makeError("Forbidden: insufficient permission", 403);
  return user.userId;
};

/**
 * Đơn pending được xác nhận/từ chối/hủy; đơn confirmed được từ chối/hủy và hoàn kho.
 * Chặn trạng thái lặp hoặc chuyển ngược để không trừ/hoàn kho thêm lần nữa.
 */
const assertOrderStatusTransition = (currentStatus, nextStatus) => {
  if (!ORDER_STATUSES.includes(nextStatus)) throw makeError("Invalid order status", 400);
  if (currentStatus === nextStatus) throw makeError(`Order already has status "${currentStatus}"`, 409);
  if (!ORDER_STATUS_TRANSITIONS[currentStatus]?.includes(nextStatus)) {
    throw makeError(`Cannot change order status from "${currentStatus}" to "${nextStatus}"`, 409);
  }
};

/**
 * Order, Inventory và StockTransaction phải được lưu cùng nhau hoặc cùng rollback.
 * MongoDB tự thử lại khi gặp xung đột ghi; lần thử lại phải đọc lại trạng thái và tồn kho.
 * Standalone trả 503, không chạy lại nghiệp vụ ngoài transaction vì sẽ mất tính toàn vẹn.
 */
const withTransaction = async (workFn) => {
  try {
    await Promise.all([Order.init(), Payment.init(), inventoryRepository.initialize()]);
    return await mongoose.connection.transaction(workFn, {
      readConcern: { level: "snapshot" },
      writeConcern: { w: "majority" },
    });
  } catch (error) {
    if (error.code === 20 && /Transaction numbers are only allowed|replica set member or mongos/.test(error.message)) {
      throw makeError("Order status changes require MongoDB replica set or Atlas transactions", 503);
    }
    if (error.code === 11000) {
      throw makeError("Stock transaction already exists for this order; reload the order before retrying", 409);
    }
    throw error;
  }
};

// Gộp các dòng cùng variant và kiểm tra số lượng trước khi so sánh với tồn kho.
const getOrderQuantities = (items) => {
  if (!Array.isArray(items) || items.length === 0) throw makeError("Order has no items", 400);
  const quantities = new Map();
  for (const item of items) {
    if (!item || !mongoose.isObjectIdOrHexString(item.variantId) ||
        !Number.isSafeInteger(item.quantity) || item.quantity <= 0) {
      throw makeError("Order contains an invalid variant or quantity", 400);
    }
    const variantId = item.variantId.toString().toLowerCase();
    const quantity = (quantities.get(variantId) || 0) + item.quantity;
    if (!Number.isSafeInteger(quantity)) throw makeError("Combined order quantity exceeds the safe integer limit", 400);
    quantities.set(variantId, quantity);
  }
  return [...quantities].sort(([left], [right]) => left.localeCompare(right))
    .map(([variantId, quantity]) => ({ variantId, quantity }));
};

const findOrder = async (orderId, session) => {
  const order = await Order.findById(orderId).select("_id userId status items").session(session).lean();
  if (!order) throw makeError("Order not found", 404);
  return order;
};

// Điều kiện trạng thái nguồn ngăn ghi đè một chuyển trạng thái đã được xử lý.
const setOrderStatus = async (orderId, fromStatus, status, session) => {
  const updated = await Order.findOneAndUpdate(
    { _id: orderId, status: fromStatus },
    { $set: { status } },
    { returnDocument: "after", runValidators: true, select: "_id status updatedAt", session }
  ).lean();
  if (!updated) throw makeError("Order status has already been changed by another request", 409);
  return updated;
};

/**
 * Chỉ pending → confirmed mới trừ kho.
 * Kiểm tra lịch sử và toàn bộ variant/tồn kho trước khi ghi; thiếu hàng trả 400.
 * Lịch sử DEDUCTION, điều kiện trạng thái và unique index cùng ngăn trừ hai lần.
 */
const confirmOrder = async (orderId, user) => {
  validateOrderId(orderId);
  const userId = validateActor(user, [ROLES.STAFF, ROLES.ADMIN]);
  return withTransaction(async (session) => {
    const order = await findOrder(orderId, session);
    assertOrderStatusTransition(order.status, "confirmed");
    if (await inventoryRepository.hasDeductionTransaction(orderId, session) ||
        await inventoryRepository.hasRestoreTransaction(orderId, session)) {
      throw makeError("Order already has stock transaction history", 409);
    }
    const deductions = getOrderQuantities(order.items);
    await inventoryRepository.deductStockForOrder(deductions, orderId, userId, session);
    return setOrderStatus(orderId, "pending", "confirmed", session);
  });
};

// Chỉ hoàn khi lịch sử trừ kho đầy đủ và khớp các dòng đơn; không đoán số đã trừ từ dữ liệu lỗi.
const validateDeductionHistory = (items, deductions) => {
  if (deductions.length === 0) {
    throw makeError("Cannot restore stock: no stock deduction history found for this order", 409);
  }
  const expected = new Map(getOrderQuantities(items).map(({ variantId, quantity }) => [variantId, quantity]));
  if (expected.size !== deductions.length) throw makeError("Stock deduction history does not match order items", 409);
  for (const deduction of deductions) {
    const variantId = deduction.variantId?.toString().toLowerCase();
    if (expected.get(variantId) !== deduction.quantity ||
        !Number.isSafeInteger(deduction.beforeQuantity) || deduction.beforeQuantity < 0 ||
        !Number.isSafeInteger(deduction.afterQuantity) || deduction.afterQuantity < 0 ||
        deduction.beforeQuantity - deduction.afterQuantity !== deduction.quantity) {
      throw makeError("Stock deduction history does not match order items", 409);
    }
    expected.delete(variantId);
  }
};

/**
 * Dùng chung cho rejected và cancelled để mọi đường chuyển đều hoàn kho đúng một lần.
 * Đơn pending chưa trừ kho nên không cộng hàng. Đơn confirmed hoàn theo lịch sử DEDUCTION.
 * RESTORE, tồn kho và trạng thái đơn nằm trong cùng transaction; lỗi ở đâu cũng rollback.
 * Giữ ràng buộc thanh toán đã có: chặn đơn paid, đồng bộ payment pending khi đóng đơn.
 */
const finishOrder = async (orderId, status, user) => {
  validateOrderId(orderId);
  const allowedRoles = status === "cancelled" ? [ROLES.CUSTOMER, ROLES.STAFF, ROLES.ADMIN] : [ROLES.STAFF, ROLES.ADMIN];
  const userId = validateActor(user, allowedRoles);
  return withTransaction(async (session) => {
    const order = await findOrder(orderId, session);
    if (user.role === ROLES.CUSTOMER && order.userId.toString() !== userId.toString()) {
      throw makeError("You do not have permission to cancel this order", 403);
    }
    assertOrderStatusTransition(order.status, status);

    const payment = await Payment.findOne({ orderId }).session(session).lean();
    if (payment?.status === "paid") {
      throw makeError("Cannot reject or cancel order: payment has already been completed. Refund workflow is not implemented.", 409);
    }

    const deductions = await inventoryRepository.getDeductionsByOrderId(orderId, session);
    if (await inventoryRepository.hasRestoreTransaction(orderId, session)) {
      throw makeError("Stock has already been restored for this order", 409);
    }
    if (order.status === "confirmed") {
      validateDeductionHistory(order.items, deductions);
      await inventoryRepository.restoreStockForOrder(deductions, orderId, userId, session);
    } else if (deductions.length > 0) {
      throw makeError("Pending order has stock deduction history; reconciliation is required", 409);
    }

    const updated = await setOrderStatus(orderId, order.status, status, session);
    if (payment?.status === "pending") {
      const result = await Payment.updateOne(
        { _id: payment._id, status: "pending" },
        { $set: { status: "cancelled" } },
        { session, runValidators: true }
      );
      if (result.modifiedCount !== 1) throw makeError("Payment status has already been changed by another request", 409);
    }
    return updated;
  });
};

const rejectOrder = (orderId, user) => finishOrder(orderId, "rejected", user);
const cancelOrder = (orderId, user) => finishOrder(orderId, "cancelled", user);

/**
 * API đổi trạng thái luôn đi qua nghiệp vụ xác nhận/từ chối/hủy tương ứng.
 * Không có đường cập nhật trực tiếp để bỏ qua kiểm tra kho, lịch sử hoặc quyền.
 */
const updateOrderStatus = async (orderId, status, user) => {
  validateOrderId(orderId);
  validateActor(user, [ROLES.STAFF, ROLES.ADMIN]);
  if (!ORDER_STATUSES.includes(status)) throw makeError("Invalid order status", 400);
  if (status === "confirmed") return confirmOrder(orderId, user);
  if (status === "rejected") return rejectOrder(orderId, user);
  if (status === "cancelled") return cancelOrder(orderId, user);
  const order = await Order.findById(orderId).select("_id status").lean();
  if (!order) throw makeError("Order not found", 404);
  assertOrderStatusTransition(order.status, status);
};

module.exports = {
  createOrder,
  getOrderById,
  assertOrderStatusTransition,
  confirmOrder,
  rejectOrder,
  cancelOrder,
  updateOrderStatus,
};
