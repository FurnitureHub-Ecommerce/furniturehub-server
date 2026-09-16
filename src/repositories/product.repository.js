/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Thực hiện các thao tác truy vấn Product trong MongoDB.
 *
 * Bước 1: Import Product Model.
 * Bước 2: Viết hàm lấy danh sách Product.
 * Bước 3: Viết hàm tìm Product theo ID.
 * Bước 4: Viết hàm tạo Product.
 * Bước 5: Viết hàm cập nhật Product.
 * Bước 6: Export các hàm để Service sử dụng.
 *
 * Lưu ý:
 * Repository chỉ thao tác với database.
 * Các nghiệp vụ kiểm tra Category, Brand và quyền
 * truy cập sẽ được xử lý tại Service và Route.
 */

const Product = require("../models/Product.model");

/**
 * Bước 2: Lấy danh sách Product.
 *
 * - Nhận điều kiện lọc từ Service.
 * - Truy vấn các Product phù hợp.
 * - Lấy thêm thông tin Category và Brand.
 * - Sắp xếp sản phẩm mới nhất lên trước.
 * - Trả về danh sách Product.
 */
const findAll = (filter = {}) => {
  return Product.find(filter)
    .populate("categoryId", "name")
    .populate("brandId", "name")
    .sort({ createdAt: -1 });
};

/**
 * Bước 3: Tìm Product theo ID.
 *
 * - Nhận ID sản phẩm.
 * - Tìm trong MongoDB.
 * - Lấy thêm thông tin Category và Brand.
 * - Trả về Product hoặc null nếu không tồn tại.
 */
const findById = (id) => {
  return Product.findById(id)
    .populate("categoryId", "name")
    .populate("brandId", "name");
};

/**
 * Bước 4: Tạo Product.
 *
 * - Nhận dữ liệu đã được Service kiểm tra.
 * - Tạo document mới trong MongoDB.
 * - Trả về Product vừa được tạo.
 */
const create = (data) => {
  return Product.create(data);
};

/**
 * Bước 5: Cập nhật Product.
 *
 * - Nhận ID và dữ liệu cần cập nhật.
 * - Tìm Product theo ID và cập nhật.
 * - Bật runValidators để kiểm tra dữ liệu.
 * - Trả về document sau khi cập nhật.
 */
const update = (id, data) => {
  return Product.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });
};

// Bước 6: Export các hàm.
module.exports = {
  findAll,
  findById,
  create,
  update,
};