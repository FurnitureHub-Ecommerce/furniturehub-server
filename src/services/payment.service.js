/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Xử lý toàn bộ nghiệp vụ thanh toán cho FurnitureHub.
 *
 * Các chức năng chính:
 * 1. Tạo Payment mới cho một Order hợp lệ của Customer.
 * 2. Lấy thông tin Payment theo orderId (Customer chỉ xem Payment của mình).
 * 3. Xác nhận / cập nhật trạng thái Payment (chỉ STAFF/ADMIN).
 *
 * Business rules quan trọng:
 * BR01: amount luôn lấy từ Order.totalAmount, không từ Frontend.
 * BR02: COD và BANK_TRANSFER đều tạo Payment với status="pending".
 * BR03: Customer không thể tự đánh dấu "paid".
 * BR04: Chỉ STAFF/ADMIN xác nhận thanh toán sau khi kiểm tra thực tế.
 * BR05: Mỗi Order chỉ có một Payment (unique index trên orderId ở Model).
 * BR06: Payment đã "paid" không được cập nhật lại.
 * BR07: Không thay đổi Inventory, OrderItems hoặc Order status khi xác nhận Payment.
 * BR08: MOMO chưa tích hợp — không xuất hiện trong SUPPORTED_METHODS.
 *
 * Kiến trúc:
 * Giữ nguyên Route → Controller → Service → Model.
 * Không dùng Repository Pattern mới, không thêm Redis/Queue.
 */

const Payment = require("../models/Payment.model");
const Order = require("../models/Order.model");
const { paymentIdSchema } = require("../validators/payment.validator");

/**
 * Các trạng thái Order được phép tạo Payment.
 *
 * Mục đích: chỉ tạo Payment khi Order đang ở trạng thái hợp lệ.
 * Hiện tại Order chỉ có status="pending" (xem Order.model.js).
 * Nếu sau này thêm "confirmed", "rejected", "cancelled" vào Order.model,
 * cập nhật danh sách này theo nghiệp vụ thực tế.
 *
 * Không tạo Payment cho Order đã "rejected" hoặc "cancelled" nếu có.
 */
const ORDER_STATUSES_ALLOW_PAYMENT = ["pending"];

/**
 * Tạo Payment mới cho một Order của Customer.
 *
 * Mục đích: ghi nhận phương thức thanh toán Customer chọn, tạo Payment với status="pending".
 *
 * Đầu vào:
 * - userId     : ObjectId từ JWT (đã xác thực bởi middleware).
 * - orderId    : string từ URL path param (đã qua Zod).
 * - paymentMethod: string từ body (đã qua Zod — chỉ COD hoặc BANK_TRANSFER).
 *
 * Bước 1: Validate orderId — sai định dạng trả 400 ngay, không query database.
 * Bước 2: Tìm Order theo _id VÀ userId — không tìm thấy hoặc khác chủ đều trả 404.
 *         Điều này ngăn Customer A xem hoặc tạo Payment cho Order của Customer B.
 * Bước 3: Kiểm tra Order status có trong danh sách cho phép tạo Payment không.
 *         Order "rejected" hoặc "cancelled" (nếu có trong tương lai) sẽ bị từ chối.
 * Bước 4: Kiểm tra Payment đã tồn tại cho Order này chưa.
 *         - Nếu Payment pending với cùng phương thức → trả Payment hiện tại (idempotent).
 *         - Nếu Payment pending với phương thức khác → trả 409 (conflict).
 *         - Nếu Payment đã "paid" → trả 409 (không cho phép tạo thêm).
 *         - Nếu Payment "cancelled" → trả 409 (cần nghiệp vụ rõ ràng trước khi cho retry).
 * Bước 5: Kiểm tra amount hợp lệ — Order.totalAmount phải > 0 và là số hữu hạn.
 * Bước 6: Tạo Payment mới với amount từ Order, status="pending".
 *         Không tự động thay đổi Order status hoặc xóa Cart.
 *
 * Đầu ra: Payment document vừa tạo hoặc Payment hiện tại (trường hợp idempotent).
 *
 * Lỗi có thể xảy ra:
 * - 400: orderId sai định dạng, amount không hợp lệ.
 * - 404: Order không tồn tại hoặc không thuộc Customer.
 * - 409: Payment đã tồn tại (xung đột).
 * - 500: lỗi database ngoài dự kiến (được Controller xử lý).
 */
const createPayment = async (userId, orderId, paymentMethod) => {
  // Bước 1: Validate orderId trước khi query.
  if (!paymentIdSchema.safeParse(orderId).success) {
    const error = new Error("Invalid order ID");
    error.statusCode = 400;
    throw error;
  }

  // Bước 2: Tìm Order theo _id VÀ userId để kiểm tra quyền sở hữu.
  const order = await Order.findOne({ _id: orderId, userId }).lean();
  if (!order) {
    const error = new Error("Order not found");
    error.statusCode = 404;
    throw error;
  }

  // Bước 3: Kiểm tra Order status cho phép tạo Payment.
  if (!ORDER_STATUSES_ALLOW_PAYMENT.includes(order.status)) {
    const error = new Error(
      `Cannot create payment for order with status "${order.status}"`
    );
    error.statusCode = 409;
    throw error;
  }

  // Bước 4: Kiểm tra Payment đã tồn tại cho Order này chưa.
  const existingPayment = await Payment.findOne({ orderId }).lean();
  if (existingPayment) {
    // Trường hợp idempotent: cùng phương thức và đang pending → trả Payment hiện tại.
    // Điều này xử lý trường hợp Customer gọi API hai lần vô tình (mạng chậm, double-click).
    if (
      existingPayment.status === "pending" &&
      existingPayment.paymentMethod === paymentMethod
    ) {
      return existingPayment;
    }

    // Trường hợp xung đột: Payment tồn tại với trạng thái hoặc phương thức khác.
    // Không tạo thêm Payment để tránh thu tiền hai lần hoặc tạo bản ghi trùng.
    const error = new Error(
      `Payment already exists for this order with status "${existingPayment.status}"`
    );
    error.statusCode = 409;
    throw error;
  }

  // Bước 5: Kiểm tra amount hợp lệ từ Order.
  const amount = order.totalAmount;
  if (!Number.isFinite(amount) || amount <= 0) {
    const error = new Error("Order has an invalid total amount");
    error.statusCode = 400;
    throw error;
  }

  // Bước 6: Tạo Payment mới — amount luôn lấy từ Order, không từ body.
  // status="pending": không bao giờ tự đánh dấu "paid" khi Customer chọn phương thức.
  // orderId có unique index ở Model nên nếu hai request đồng thời vượt qua bước 4,
  // chỉ một insert thành công; insert thứ hai sẽ throw MongoServerError code 11000.
  try {
    const payment = new Payment({
      orderId,
      amount,
      paymentMethod,
      status: "pending",
    });
    await payment.save();
    return payment.toObject({ versionKey: false });
  } catch (err) {
    // Bắt lỗi duplicate key (code 11000) từ unique index — xảy ra khi hai request đồng thời.
    if (err.code === 11000) {
      // Đọc lại Payment vừa được tạo bởi request đồng thời để trả về nhất quán.
      const racePayment = await Payment.findOne({ orderId }).lean();
      if (racePayment) return racePayment;
    }
    // Lỗi database khác — chuyển lên Controller để trả 500.
    throw err;
  }
};

/**
 * Lấy thông tin Payment theo orderId của Customer.
 *
 * Mục đích: Customer xem trạng thái thanh toán của đơn hàng mình.
 *
 * Đầu vào:
 * - userId : ObjectId từ JWT (đã xác thực bởi middleware).
 * - orderId: string từ URL path param (đã qua Zod).
 *
 * Bước 1: Validate orderId — sai định dạng trả 400.
 * Bước 2: Kiểm tra Order tồn tại và thuộc Customer hiện tại.
 *         Trả 404 nếu không tìm thấy hoặc khác chủ, không tiết lộ thông tin quyền sở hữu.
 * Bước 3: Tìm Payment theo orderId.
 *         Trả 404 nếu Payment chưa được tạo.
 *
 * Đầu ra: Payment document của Order đó.
 *
 * Không trả thông tin nhạy cảm (credentials cổng thanh toán).
 * Không populate confirmedBy để tránh lộ thông tin nhân viên cho Customer.
 */
const getPaymentByOrderId = async (userId, orderId) => {
  // Bước 1: Validate orderId.
  if (!paymentIdSchema.safeParse(orderId).success) {
    const error = new Error("Invalid order ID");
    error.statusCode = 400;
    throw error;
  }

  // Bước 2: Kiểm tra Order thuộc Customer hiện tại.
  const order = await Order.findOne({ _id: orderId, userId }).lean();
  if (!order) {
    const error = new Error("Order not found");
    error.statusCode = 404;
    throw error;
  }

  // Bước 3: Tìm Payment theo orderId.
  const payment = await Payment.findOne({ orderId })
    .select("-__v")
    .lean();
  if (!payment) {
    const error = new Error("Payment not found");
    error.statusCode = 404;
    throw error;
  }

  return payment;
};

/**
 * Cập nhật trạng thái Payment (chỉ STAFF/ADMIN).
 *
 * Mục đích: cho phép nhân viên xác nhận thanh toán sau khi kiểm tra thực tế.
 *
 * Đầu vào:
 * - confirmerId: userId từ JWT của STAFF/ADMIN (đã xác thực bởi middleware).
 * - paymentId  : string từ URL path param (đã qua Zod).
 * - status     : "paid" hoặc "cancelled" (đã qua Zod).
 * - note       : chuỗi tùy chọn để nhân viên ghi chú (ví dụ: mã giao dịch).
 *
 * Bước 1: Validate paymentId — sai định dạng trả 400.
 * Bước 2: Tìm Payment — không tìm thấy trả 404.
 * Bước 3: Kiểm tra trạng thái hiện tại có cho phép chuyển không.
 *         - "paid"      → không được cập nhật lại (đã chốt).
 *         - "cancelled" → không được cập nhật lại.
 *         - "failed"    → không được cập nhật (trạng thái hệ thống, không cập nhật thủ công).
 *         - Chỉ "pending" mới được phép chuyển sang "paid" hoặc "cancelled".
 * Bước 4: Cập nhật Payment trong một thao tác findOneAndUpdate nguyên tử.
 *         Dùng điều kiện { _id, status: "pending" } để tránh race condition:
 *         nếu hai nhân viên xác nhận cùng lúc, chỉ một lần cập nhật thành công.
 *         findOneAndUpdate trả null nếu Payment không còn ở trạng thái "pending".
 * Bước 5: Gán paidAt khi status="paid"; lưu confirmedBy để truy vết.
 *
 * Đầu ra: Payment document đã được cập nhật.
 *
 * Không tự động cập nhật Order status, không thay đổi Inventory (BR07, BR11).
 *
 * Lỗi có thể xảy ra:
 * - 400: paymentId sai định dạng.
 * - 404: Payment không tồn tại.
 * - 409: Payment không ở trạng thái "pending" hoặc đã được cập nhật bởi request khác.
 * - 500: lỗi database ngoài dự kiến.
 */
const updatePaymentStatus = async (confirmerId, paymentId, status, note) => {
  // Bước 1: Validate paymentId.
  if (!paymentIdSchema.safeParse(paymentId).success) {
    const error = new Error("Invalid payment ID");
    error.statusCode = 400;
    throw error;
  }

  // Bước 2: Tìm Payment để kiểm tra tồn tại và trạng thái hiện tại.
  const payment = await Payment.findById(paymentId).lean();
  if (!payment) {
    const error = new Error("Payment not found");
    error.statusCode = 404;
    throw error;
  }

  // Bước 3: Kiểm tra trạng thái chuyển tiếp hợp lệ.
  // Chỉ "pending" mới được phép cập nhật thủ công.
  if (payment.status !== "pending") {
    const error = new Error(
      `Cannot update payment with status "${payment.status}". Only "pending" payments can be updated.`
    );
    error.statusCode = 409;
    throw error;
  }

  // Bước 4 & 5: Cập nhật nguyên tử với điều kiện status="pending".
  // Dùng findOneAndUpdate thay vì save để xử lý race condition:
  // nếu hai nhân viên gọi API cùng lúc, chỉ một request cập nhật thành công.
  // { new: true } để nhận document sau khi đã cập nhật.
  const updateData = {
    status,
    confirmedBy: confirmerId,
    // Chỉ gán paidAt khi chuyển sang "paid"; không gán cho "cancelled".
    ...(status === "paid" && { paidAt: new Date() }),
    // Lưu note nếu nhân viên cung cấp; null nếu không có.
    note: note || null,
  };

  const updatedPayment = await Payment.findOneAndUpdate(
    { _id: paymentId, status: "pending" }, // Điều kiện: chỉ cập nhật khi vẫn còn "pending".
    { $set: updateData },
    { new: true, runValidators: true } // Trả document mới và chạy validator schema.
  ).lean();

  // Nếu null: Payment đã bị cập nhật bởi request đồng thời khác.
  if (!updatedPayment) {
    const error = new Error(
      "Payment status has already been updated by another request"
    );
    error.statusCode = 409;
    throw error;
  }

  return updatedPayment;
};

module.exports = {
  createPayment,
  getPaymentByOrderId,
  updatePaymentStatus,
};
