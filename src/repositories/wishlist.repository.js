/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Thực hiện các thao tác truy vấn MongoDB
 * đối với collection wishlists.
 *
 * Bước 1: Import Wishlist Model.
 * Bước 2: Lấy Wishlist của một User.
 * Bước 3: Tìm một sản phẩm trong Wishlist.
 * Bước 4: Thêm sản phẩm vào Wishlist.
 * Bước 5: Xóa sản phẩm khỏi Wishlist.
 * Bước 6: Export các hàm cho Service.
 */

const Wishlist = require("../models/Wishlist.model");

/**
 * Bước 2: Lấy danh sách yêu thích.
 *
 * - Nhận userId từ Service.
 * - Chỉ tìm các bản ghi thuộc về User đó.
 * - Populate productId để lấy thông tin Product.
 * - Sắp xếp sản phẩm mới thêm lên đầu.
 * - Trả về danh sách Wishlist.
 */
const findByUserId = async (userId) => {
  return Wishlist.find({ userId })
    .populate(
      "productId",
      "name description images categoryId brandId isActive"
    )
    .sort({ createdAt: -1 });
};

/**
 * Bước 3: Tìm một sản phẩm trong Wishlist.
 *
 * - Nhận userId và productId.
 * - Tìm bản ghi khớp đồng thời cả hai ID.
 * - Trả về Wishlist nếu tìm thấy.
 * - Trả về null nếu không tồn tại.
 *
 * Điều kiện userId giúp đảm bảo không truy vấn
 * nhầm Wishlist của khách hàng khác.
 */
const findByUserAndProduct = async (
  userId,
  productId
) => {
  return Wishlist.findOne({
    userId,
    productId,
  });
};

/**
 * Bước 4: Thêm sản phẩm vào Wishlist.
 *
 * - Nhận userId và productId từ Service.
 * - Tạo document Wishlist mới.
 * - MongoDB tự động tạo _id.
 * - timestamps tự động lưu createdAt và updatedAt.
 * - Trả về document vừa tạo.
 */
const create = async (userId, productId) => {
  return Wishlist.create({
    userId,
    productId,
  });
};

/**
 * Bước 5: Xóa sản phẩm khỏi Wishlist.
 *
 * - Nhận userId và productId.
 * - Chỉ xóa bản ghi khớp cả hai điều kiện.
 * - Không ảnh hưởng Product trong collection products.
 * - Không ảnh hưởng Wishlist của User khác.
 * - Trả về document vừa bị xóa hoặc null.
 */
const remove = async (userId, productId) => {
  return Wishlist.findOneAndDelete({
    userId,
    productId,
  });
};

// Bước 6: Export các hàm cho Service sử dụng.
module.exports = {
  findByUserId,
  findByUserAndProduct,
  create,
  remove,
};