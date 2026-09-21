/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Định nghĩa cấu trúc dữ liệu thanh toán cho FurnitureHub.
 *
 * Thiết kế:
 * - Mỗi Order có đúng một Payment (unique index trên orderId).
 * - Payment lưu amount được sao chép từ Order.totalAmount tại thời điểm tạo.
 *   Không cho phép Frontend gửi amount; amount chỉ lấy từ Order đã lưu.
 * - Trạng thái ban đầu luôn là "pending" — không bao giờ tự động đánh dấu "paid".
 * - Chỉ STAFF hoặc ADMIN mới được chuyển trạng thái sang "paid" sau khi xác minh thực tế.
 * - confirmedBy lưu userId của người xác nhận để truy vết; null khi chưa xác nhận.
 * - paidAt lưu thời điểm xác nhận thanh toán; null khi chưa thanh toán.
 * - note dùng để nhân viên ghi chú khi xác nhận (ví dụ: số giao dịch, tên khách chuyển).
 *
 * Quy tắc trạng thái:
 * - pending  → paid      : chỉ STAFF/ADMIN xác nhận thực tế.
 * - pending  → cancelled : chỉ STAFF/ADMIN hủy thanh toán.
 * - paid     → (không được chuyển sang trạng thái khác).
 * - cancelled→ (không được tạo lại hoặc khôi phục).
 * Các quy tắc chuyển trạng thái này được kiểm tra ở tầng Service, không phải Model.
 *
 * Phương thức thanh toán được hỗ trợ thực tế:
 * - COD          : thanh toán khi nhận hàng.
 * - BANK_TRANSFER: chuyển khoản ngân hàng (xác nhận thủ công bởi nhân viên).
 * - MOMO         : chưa tích hợp; không xuất hiện như lựa chọn có thể thanh toán thành công.
 *   Xem thêm: payment.service.js — SUPPORTED_METHODS.
 *
 * Lưu ý bảo mật:
 * - Không lưu thông tin thẻ ngân hàng, credentials thanh toán hoặc bất kỳ secret nào.
 * - orderId có unique index để ngăn tạo hai Payment trên cùng một Order dù request đồng thời.
 */

const mongoose = require("mongoose");

/**
 * Danh sách phương thức thanh toán hỗ trợ trong schema.
 * Thêm vào đây khi tích hợp thực sự đã được cấu hình và kiểm tra.
 */
const PAYMENT_METHODS = ["COD", "BANK_TRANSFER"];

/**
 * Danh sách trạng thái thanh toán hợp lệ.
 * Chuyển trạng thái được kiểm tra ở Service, không phải Model.
 */
const PAYMENT_STATUSES = ["pending", "paid", "failed", "cancelled"];

const paymentSchema = new mongoose.Schema(
  {
    /**
     * Liên kết với Order tương ứng.
     * unique: true đảm bảo mỗi Order chỉ có một Payment record.
     * immutable: true ngăn thay đổi orderId sau khi đã tạo.
     */
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
      immutable: true,
    },

    /**
     * Số tiền thanh toán — được sao chép từ Order.totalAmount khi tạo Payment.
     * Backend tự lấy; Frontend không được phép gửi giá trị này.
     * immutable: true ngăn thay đổi amount sau khi đã chốt.
     */
    amount: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isFinite,
      immutable: true,
    },

    /**
     * Phương thức thanh toán do Customer chọn.
     * Chỉ chấp nhận giá trị trong PAYMENT_METHODS.
     * immutable: true ngăn thay đổi phương thức sau khi đã tạo.
     */
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      required: true,
      immutable: true,
    },

    /**
     * Trạng thái thanh toán hiện tại.
     * Mặc định là "pending" — không bao giờ tự động đánh dấu "paid".
     * Chỉ được cập nhật bởi STAFF/ADMIN qua API xác nhận thanh toán.
     */
    status: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: "pending",
      required: true,
    },

    /**
     * Thời điểm thanh toán được xác nhận là thành công.
     * Chỉ được gán khi status chuyển sang "paid".
     * null khi Payment chưa được xác nhận.
     */
    paidAt: {
      type: Date,
      default: null,
    },

    /**
     * userId của STAFF/ADMIN đã xác nhận thanh toán.
     * Dùng để truy vết lịch sử xác nhận.
     * null khi Payment chưa được xác nhận.
     */
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    /**
     * Ghi chú từ nhân viên khi xác nhận thanh toán.
     * Ví dụ: mã giao dịch chuyển khoản, tên người gửi, thời gian chuyển.
     * Không bắt buộc; null khi không có ghi chú.
     */
    note: {
      type: String,
      trim: true,
      default: null,
    },
  },
  {
    /**
     * Tự động tạo createdAt và updatedAt.
     * createdAt: thời điểm Customer khởi tạo Payment.
     * updatedAt: cập nhật mỗi khi status thay đổi.
     */
    timestamps: true,
  }
);

// Export constants để Service và Validator sử dụng mà không cần import mongoose.
paymentSchema.statics.PAYMENT_METHODS = PAYMENT_METHODS;
paymentSchema.statics.PAYMENT_STATUSES = PAYMENT_STATUSES;

module.exports = mongoose.model("Payment", paymentSchema);
