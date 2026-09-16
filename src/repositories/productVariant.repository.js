/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Thực hiện truy vấn ProductVariant trong MongoDB.
 *
 * Bước 1: Import ProductVariant Model.
 * Bước 2: Viết hàm lấy danh sách Variant của Product.
 * Bước 3: Viết hàm tìm Variant theo ID.
 * Bước 4: Viết hàm tìm Variant theo SKU.
 * Bước 5: Viết hàm tạo Variant.
 * Bước 6: Viết hàm cập nhật Variant.
 * Bước 7: Export các hàm.
 *
 * Lưu ý:
 * Repository chỉ làm việc với database.
 * Kiểm tra nghiệp vụ trùng SKU, tổ hợp biến thể
 * và trạng thái Product sẽ được xử lý trong Service.
 */

const ProductVariant = require("../models/ProductVariant.model");

/**
 * Bước 2: Lấy danh sách Variant theo Product.
 *
 * - Nhận productId.
 * - Nhận bộ lọc bổ sung nếu có.
 * - Tìm các Variant thuộc Product.
 * - Sắp xếp theo thời gian tạo mới nhất.
 * - Trả về danh sách.
 */
const findByProductId = (productId, filter = {}) => {
  return ProductVariant.find({
    productId,
    ...filter,
  }).sort({ createdAt: -1 });
};

/**
 * Bước 3: Tìm Variant theo ID.
 *
 * - Nhận ID của Variant.
 * - Tìm document trong MongoDB.
 * - Trả về Variant hoặc null.
 */
const findById = (id) => {
  return ProductVariant.findById(id);
};

/**
 * Bước 4: Tìm Variant theo SKU.
 *
 * - Nhận SKU cần tìm.
 * - Tìm Variant có SKU tương ứng.
 * - Trả về Variant hoặc null.
 */
const findBySku = (sku) => {
  return ProductVariant.findOne({
    sku: sku.trim().toUpperCase(),
  });
};

/**
 * Bước 5: Tạo Variant.
 *
 * - Nhận dữ liệu đã được Service kiểm tra.
 * - Lưu Variant vào MongoDB.
 * - Trả về document vừa tạo.
 */
const create = (data) => {
  return ProductVariant.create(data);
};

/**
 * Bước 6: Cập nhật Variant.
 *
 * - Nhận ID và dữ liệu cần sửa.
 * - Tìm Variant theo ID và cập nhật.
 * - Bật validation của Mongoose.
 * - Trả về document sau khi cập nhật.
 */
const update = (id, data) => {
  return ProductVariant.findByIdAndUpdate(
    id,
    data,
    {
      new: true,
      runValidators: true,
    }
  );
};

// Bước 7: Export các hàm.
module.exports = {
  findByProductId,
  findById,
  findBySku,
  create,
  update,
};