/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Tiếp nhận HTTP request Payment, ủy quyền cho Service xử lý nghiệp vụ,
 * và trả JSON response theo convention dự án (message + data hoặc chỉ message).
 *
 * Convention response của dự án:
 * - 201: { message, payment }
 * - 200: { payment }
 * - Lỗi: { message } (không trả stack, không trả thông tin nội bộ)
 *
 * Xử lý lỗi:
 * - 400: lỗi validate đầu vào (orderId/paymentId sai định dạng).
 * - 401: thiếu/sai JWT (handled by authMiddleware trước Controller này).
 * - 403: sai role (handled by authorizeRoles trước Controller này).
 * - 404: Order/Payment không tìm thấy hoặc không thuộc Customer.
 * - 409: Payment đã tồn tại / xung đột trạng thái.
 * - 500: lỗi database hoặc ngoài dự kiến — không lộ chi tiết nội bộ.
 *
 * Lưu ý:
 * Controller không chứa logic nghiệp vụ.
 * Không đọc userId/amount từ body; tất cả dữ liệu nhạy cảm lấy từ JWT và database.
 */

const paymentService = require("../services/payment.service");

/**
 * Chuyển lỗi từ Service thành HTTP response phù hợp.
 *
 * Mục đích: xử lý lỗi tập trung, không lặp lại ở mỗi handler.
 * Đầu vào: res (Express response), error (Error với statusCode tùy chọn).
 * Bước 1: Xác định mã HTTP — chỉ công bố 400/404/409, các lỗi khác trả 500.
 * Bước 2: Trả JSON với message rõ ràng; lỗi 500 trả thông báo chung.
 *
 * Không trả stack trace hoặc thông tin database lên Frontend.
 */
const handleError = (res, error) => {
  const allowedCodes = [400, 404, 409];
  const statusCode = allowedCodes.includes(error.statusCode)
    ? error.statusCode
    : 500;
  return res.status(statusCode).json({
    message: statusCode === 500 ? "Internal server error" : error.message,
  });
};

/**
 * Tạo Payment cho Order của Customer.
 *
 * Mục đích: Customer khởi tạo thanh toán cho đơn hàng của mình.
 *
 * Đầu vào:
 * - req.user.userId: từ JWT (authMiddleware gắn vào).
 * - req.params.orderId: ID của Order từ URL.
 * - req.body.paymentMethod: phương thức thanh toán đã qua Zod validate.
 *
 * Bước 1: Lấy userId từ JWT — không dùng userId từ body.
 * Bước 2: Gọi Service tạo Payment, ủy quyền toàn bộ nghiệp vụ.
 * Bước 3: Trả 201 kèm { message, payment } khi thành công.
 * Bước 4: Chuyển lỗi qua handleError để trả mã HTTP phù hợp.
 *
 * Trường hợp idempotent (Payment pending cùng method đã tồn tại):
 * Service trả Payment hiện tại; Controller vẫn trả 201 để Client biết payment đã được ghi nhận.
 * Thực tế đây là idempotent nên có thể trả 200, nhưng 201 nhất quán với lần đầu.
 */
const createPayment = async (req, res) => {
  try {
    const payment = await paymentService.createPayment(
      req.user.userId,
      req.params.orderId,
      req.body.paymentMethod
    );
    return res.status(201).json({ message: "Payment created successfully", payment });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Lấy thông tin Payment của Order thuộc Customer hiện tại.
 *
 * Mục đích: Customer xem trạng thái thanh toán của đơn hàng.
 *
 * Đầu vào:
 * - req.user.userId: từ JWT.
 * - req.params.orderId: ID của Order từ URL.
 *
 * Bước 1: Lấy userId từ JWT.
 * Bước 2: Gọi Service lấy Payment theo orderId và kiểm tra quyền sở hữu.
 * Bước 3: Trả 200 kèm { payment } khi tìm thấy.
 * Bước 4: Chuyển lỗi qua handleError.
 *
 * Không trả confirmedBy detail để tránh lộ thông tin nhân viên cho Customer.
 */
const getPayment = async (req, res) => {
  try {
    const payment = await paymentService.getPaymentByOrderId(
      req.user.userId,
      req.params.orderId
    );
    return res.status(200).json({ payment });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Cập nhật trạng thái Payment (chỉ STAFF/ADMIN).
 *
 * Mục đích: nhân viên xác nhận thanh toán sau khi kiểm tra thực tế.
 *
 * Đầu vào:
 * - req.user.userId: userId của nhân viên xác nhận từ JWT.
 * - req.params.paymentId: ID của Payment từ URL.
 * - req.body.status: trạng thái mới ("paid" hoặc "cancelled") đã qua Zod.
 * - req.body.note: ghi chú tùy chọn từ nhân viên.
 *
 * Bước 1: Lấy confirmerId từ JWT — không cho Customer gọi endpoint này (role middleware).
 * Bước 2: Gọi Service cập nhật trạng thái, ủy quyền toàn bộ kiểm tra nghiệp vụ.
 * Bước 3: Trả 200 kèm { message, payment } khi thành công.
 * Bước 4: Chuyển lỗi qua handleError.
 *
 * Customer không được phép gọi endpoint này (được ngăn bởi authorizeRoles ở route).
 * Không tự động cập nhật Order status hoặc Inventory khi xác nhận.
 */
const updatePaymentStatus = async (req, res) => {
  try {
    const payment = await paymentService.updatePaymentStatus(
      req.user.userId,
      req.params.paymentId,
      req.body.status,
      req.body.note
    );
    return res.status(200).json({ message: "Payment status updated successfully", payment });
  } catch (error) {
    return handleError(res, error);
  }
};

module.exports = { createPayment, getPayment, updatePaymentStatus };
