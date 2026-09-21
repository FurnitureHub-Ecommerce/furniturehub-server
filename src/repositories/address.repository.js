/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Thực hiện các thao tác truy vấn MongoDB cho collection addresses.
 *
 * Bước 1: Import Address Model.
 * Bước 2: Tìm tất cả địa chỉ của một User.
 * Bước 3: Tìm một địa chỉ theo ID và userId (kiểm tra quyền sở hữu).
 * Bước 4: Tạo địa chỉ mới.
 * Bước 5: Lưu địa chỉ sau khi thay đổi.
 * Bước 6: Xóa địa chỉ theo ID.
 * Bước 7: Tìm địa chỉ mặc định của User.
 * Bước 8: Bỏ mặc định tất cả địa chỉ của User (dùng khi đặt địa chỉ khác làm mặc định).
 * Bước 9: Tìm địa chỉ cũ nhất của User (dùng khi xóa địa chỉ mặc định).
 * Bước 10: Đếm số địa chỉ của User.
 * Bước 11: Export các hàm cho Service.
 *
 * Lưu ý:
 * - Repository chỉ thực hiện truy vấn database.
 * - Toàn bộ kiểm tra nghiệp vụ được xử lý ở tầng Service.
 * - Mỗi truy vấn đều lọc theo userId để đảm bảo Customer
 *   không thể truy cập địa chỉ của Customer khác.
 */

const Address = require("../models/Address.model");

/**
 * Bước 2: Lấy tất cả địa chỉ của một User.
 *
 * - Nhận userId từ Service.
 * - Trả về danh sách địa chỉ, sắp xếp: mặc định trước, mới nhất sau.
 * - Nếu User chưa có địa chỉ, trả về mảng rỗng.
 *
 * Sắp xếp:
 * - isDefault: -1 → địa chỉ mặc định (true) hiển thị đầu tiên.
 * - createdAt: -1 → địa chỉ mới nhất hiển thị trước.
 */
const findByUserId = async (userId) => {
  return Address.find({ userId }).sort({
    isDefault: -1,
    createdAt: -1,
  });
};

/**
 * Bước 3: Tìm địa chỉ theo ID và xác nhận thuộc về User.
 *
 * - Nhận addressId và userId.
 * - Tìm địa chỉ khớp cả hai điều kiện để đảm bảo quyền sở hữu.
 * - Trả về địa chỉ hoặc null nếu không tìm thấy.
 *
 * Kiểm tra đồng thời _id VÀ userId đảm bảo:
 * - Customer A không thể xem/sửa/xóa địa chỉ của Customer B
 *   dù biết được addressId của B.
 * - Trả về null cả hai trường hợp: không tồn tại hoặc không phải chủ sở hữu.
 *   Service sẽ trả HTTP 404, tránh tiết lộ dữ liệu của Customer khác.
 */
const findByIdAndUserId = async (addressId, userId) => {
  return Address.findOne({ _id: addressId, userId });
};

/**
 * Bước 4: Tạo địa chỉ mới.
 *
 * - Nhận dữ liệu địa chỉ từ Service (đã bao gồm userId và isDefault).
 * - Tạo và lưu document mới vào collection addresses.
 * - Trả về document vừa tạo.
 *
 * Mongoose tự thêm _id, createdAt, updatedAt khi tạo.
 */
const create = async (data) => {
  return Address.create(data);
};

/**
 * Bước 5: Lưu thay đổi của một địa chỉ.
 *
 * - Nhận document Address đã được chỉnh sửa trong bộ nhớ.
 * - Gọi .save() để đồng bộ lên MongoDB.
 * - Mongoose tự cập nhật updatedAt.
 * - Trả về document sau khi lưu.
 */
const save = async (address) => {
  return address.save();
};

/**
 * Bước 6: Xóa một địa chỉ khỏi database.
 *
 * - Nhận addressId và userId để xóa đúng địa chỉ của đúng User.
 * - Trả về document đã xóa hoặc null nếu không tìm thấy.
 *
 * Xóa hard delete (xóa hoàn toàn khỏi collection),
 * không phải soft delete vì địa chỉ đã lưu trong Order
 * sẽ có snapshot riêng, không tham chiếu đến document này.
 */
const deleteByIdAndUserId = async (addressId, userId) => {
  return Address.findOneAndDelete({ _id: addressId, userId });
};

/**
 * Bước 7: Tìm địa chỉ mặc định của User.
 *
 * - Nhận userId.
 * - Trả về địa chỉ có isDefault = true, hoặc null nếu không có.
 *
 * Mỗi User chỉ có tối đa một địa chỉ mặc định.
 * Dùng để kiểm tra và bỏ mặc định trước khi đặt địa chỉ khác làm mặc định.
 */
const findDefaultByUserId = async (userId) => {
  return Address.findOne({ userId, isDefault: true });
};

/**
 * Bước 8: Bỏ mặc định tất cả địa chỉ của User.
 *
 * - Nhận userId.
 * - Cập nhật tất cả địa chỉ của User: isDefault = false.
 * - Dùng updateMany để đảm bảo không còn địa chỉ mặc định nào.
 *
 * Gọi hàm này trước khi đặt một địa chỉ mới làm mặc định
 * để đảm bảo tính nhất quán: mỗi User chỉ có một địa chỉ mặc định.
 *
 * Lưu ý về đồng thời:
 * Trong môi trường single-node MongoDB (không replica set),
 * không dùng transaction được. Thay vào đó, thực hiện hai thao tác tuần tự:
 * 1. Bỏ mặc định tất cả địa chỉ hiện tại.
 * 2. Đặt địa chỉ mới làm mặc định.
 * Trong khoảng thời gian rất ngắn giữa hai bước, có thể không có địa chỉ mặc định.
 * Đây là giới hạn chấp nhận được trong phạm vi SDN302.
 */
const clearDefaultByUserId = async (userId) => {
  return Address.updateMany({ userId }, { $set: { isDefault: false } });
};

/**
 * Bước 9: Tìm địa chỉ được tạo sớm nhất của User (trừ một ID cụ thể).
 *
 * - Nhận userId và excludeId (ID địa chỉ vừa bị xóa, cần loại trừ).
 * - Trả về địa chỉ cũ nhất còn lại sau khi xóa.
 *
 * Dùng khi Customer xóa địa chỉ mặc định và vẫn còn địa chỉ khác.
 * Tự động chọn địa chỉ được tạo sớm nhất làm mặc định mới.
 * Lý do chọn cũ nhất: địa chỉ được thêm đầu tiên thường là địa chỉ chính.
 */
const findOldestByUserId = async (userId, excludeId) => {
  return Address.findOne({
    userId,
    _id: { $ne: excludeId },
  }).sort({ createdAt: 1 });
};

/**
 * Bước 10: Đếm tổng số địa chỉ của User.
 *
 * - Nhận userId.
 * - Trả về số lượng địa chỉ hiện có.
 *
 * Dùng để xác định địa chỉ đầu tiên của User
 * (khi count = 0, địa chỉ mới sẽ tự động là mặc định).
 */
const countByUserId = async (userId) => {
  return Address.countDocuments({ userId });
};

// Bước 11: Export các hàm cho Service sử dụng.
module.exports = {
  findByUserId,
  findByIdAndUserId,
  create,
  save,
  deleteByIdAndUserId,
  findDefaultByUserId,
  clearDefaultByUserId,
  findOldestByUserId,
  countByUserId,
};
