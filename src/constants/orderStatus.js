/**
 * @Author: Minh Truong
 *
 * Mục đích: dùng chung trạng thái và quy tắc chuyển cho Model, Validator,
 * Service và Swagger, tránh mỗi nơi định nghĩa một danh sách khác nhau.
 *
 * Pending được chuyển sang confirmed, rejected hoặc cancelled.
 * Confirmed được chuyển sang rejected/cancelled và phải hoàn kho đã trừ.
 * Confirmed được chuyển sang shipping, sau đó shipping chuyển sang delivered.
 * Delivered, rejected và cancelled là trạng thái kết thúc, không được chuyển tiếp.
 * Quy tắc hợp lệ không có nghĩa là được ghi ngay: Service còn phải kiểm tra
 * nghiệp vụ xác nhận/từ chối/hủy và xử lý kho trước khi cho phép chuyển.
 * Đóng băng cả các mảng con để mã khác không vô tình mở thêm đường chuyển.
 */
const ORDER_STATUSES = Object.freeze([
  "pending",
  "confirmed",
  "shipping",
  "delivered",
  "rejected",
  "cancelled",
]);

const ORDER_STATUS_TRANSITIONS = Object.freeze({
  pending: Object.freeze(["confirmed", "rejected", "cancelled"]),
  confirmed: Object.freeze(["shipping", "rejected", "cancelled"]),
  shipping: Object.freeze(["delivered"]),
  delivered: Object.freeze([]),
  rejected: Object.freeze([]),
  cancelled: Object.freeze([]),
});

module.exports = { ORDER_STATUSES, ORDER_STATUS_TRANSITIONS };
