/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Kiểm tra đầu vào cho tất cả Payment API bằng Zod.
 *
 * Schema 1 — createPaymentSchema:
 *   Dùng cho POST /api/orders/:orderId/payment (Customer tạo Payment).
 *   Chỉ nhận paymentMethod trong danh sách được hỗ trợ thực sự.
 *   Không nhận: userId, amount, totalAmount, paymentStatus, orderStatus, isPaid.
 *   Backend tự lấy amount từ Order, không tin dữ liệu Frontend.
 *
 * Schema 2 — updatePaymentStatusSchema:
 *   Dùng cho PATCH /api/payments/:paymentId/status (STAFF/ADMIN xác nhận).
 *   Chỉ nhận status trong danh sách trạng thái được phép chuyển.
 *   Customer không được gọi endpoint này (kiểm tra ở middleware).
 *   note là tùy chọn; dùng để nhân viên ghi thông tin xác nhận.
 *
 * Schema 3 — paymentIdSchema:
 *   Dùng để validate paymentId hoặc orderId dạng MongoDB ObjectId.
 *   Kiểm tra trước khi query để tránh CastError từ Mongoose.
 *
 * Lưu ý:
 * MOMO không nằm trong SUPPORTED_METHODS vì chưa tích hợp thực tế.
 * Thêm vào SUPPORTED_METHODS sau khi cấu hình sandbox đã được kiểm tra.
 */

const { z } = require("zod");

/**
 * Danh sách phương thức thanh toán được hỗ trợ thực tế trong hệ thống.
 *
 * COD          : thanh toán khi nhận hàng — luôn pending đến khi nhân viên xác nhận.
 * BANK_TRANSFER: chuyển khoản ngân hàng — pending đến khi nhân viên đối soát và xác nhận.
 * MOMO         : chưa tích hợp — không xuất hiện trong danh sách này để tránh hiểu lầm.
 *
 * Khi thêm MOMO: bổ sung vào đây SAU KHI đã có SDK, cấu hình sandbox, IPN handler
 * và xác thực chữ ký callback đầy đủ.
 */
const SUPPORTED_METHODS = ["COD", "BANK_TRANSFER"];

/**
 * Danh sách trạng thái mà STAFF/ADMIN được phép chuyển đến.
 *
 * paid      : xác nhận đã nhận tiền thực tế (COD đã thu / chuyển khoản đã kiểm tra).
 * cancelled : hủy Payment theo quy trình được phân quyền.
 *
 * "pending" và "failed" không được phép gửi từ client.
 * Backend không cho phép mọi trạng thái chuyển đổi tự do.
 */
const ALLOWED_STATUS_TRANSITIONS = ["paid", "cancelled"];

/**
 * Schema kiểm tra ObjectId dạng MongoDB 24 ký tự hex.
 * Dùng để validate paymentId, orderId từ URL params trước khi query.
 * Kiểm tra sớm để trả 400 rõ ràng thay vì để Mongoose throw CastError.
 */
const paymentIdSchema = z
  .string()
  .regex(/^[a-fA-F0-9]{24}$/, { message: "Invalid ID format" });

/**
 * Schema tạo Payment mới.
 *
 * Đầu vào (request body):
 * - paymentMethod: bắt buộc, phải là một trong SUPPORTED_METHODS.
 *
 * Không nhận:
 * - amount, totalAmount (Backend tự lấy từ Order.totalAmount).
 * - userId (lấy từ JWT).
 * - paymentStatus, isPaid (Backend quản lý, không tin Frontend).
 * - orderId (lấy từ URL path param, không từ body).
 *
 * additionalProperties: false ngăn Customer gửi thêm trường ngoài dự kiến.
 */
const createPaymentSchema = z
  .object({
    paymentMethod: z.enum(SUPPORTED_METHODS, {
      errorMap: () => ({
        message: `Payment method must be one of: ${SUPPORTED_METHODS.join(", ")}`,
      }),
    }),
  })
  .strict(); // Từ chối mọi trường không khai báo.

/**
 * Schema cập nhật trạng thái Payment.
 *
 * Đầu vào (request body):
 * - status: bắt buộc, phải là một trong ALLOWED_STATUS_TRANSITIONS.
 * - note: tùy chọn, chuỗi tối đa 500 ký tự để nhân viên ghi chú xác nhận.
 *
 * Không cho phép Customer gọi endpoint này (kiểm tra ở route middleware).
 * Chuyển trạng thái hợp lệ được kiểm tra thêm ở Service (ví dụ: paid không thể quay lại).
 */
const updatePaymentStatusSchema = z
  .object({
    status: z.enum(ALLOWED_STATUS_TRANSITIONS, {
      errorMap: () => ({
        message: `Status must be one of: ${ALLOWED_STATUS_TRANSITIONS.join(", ")}`,
      }),
    }),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

module.exports = {
  createPaymentSchema,
  updatePaymentStatusSchema,
  paymentIdSchema,
  SUPPORTED_METHODS,
  ALLOWED_STATUS_TRANSITIONS,
};
