/**
 * @Author: Minh Truong
 *
 * Mục đích: dùng chung trạng thái và quy tắc chuyển cho Model, Validator,
 * Service và Swagger, tránh mỗi nơi định nghĩa một danh sách khác nhau.
 *
 * Chỉ pending được chuyển sang confirmed, rejected hoặc cancelled.
 * Ba trạng thái đích là trạng thái kết thúc trong phạm vi hiện tại.
 * Quy tắc hợp lệ không có nghĩa là được ghi ngay: Service còn phải kiểm tra
 * nghiệp vụ xác nhận/từ chối/hủy và xử lý kho trước khi cho phép chuyển.
 * Đóng băng cả các mảng con để mã khác không vô tình mở thêm đường chuyển.
 */
const ORDER_STATUSES = Object.freeze([
  "pending",
  "confirmed",
  "rejected",
  "cancelled",
]);

const ORDER_STATUS_TRANSITIONS = Object.freeze({
  pending: Object.freeze(["confirmed", "rejected", "cancelled"]),
  confirmed: Object.freeze([]),
  rejected: Object.freeze([]),
  cancelled: Object.freeze([]),
});

module.exports = { ORDER_STATUSES, ORDER_STATUS_TRANSITIONS };
