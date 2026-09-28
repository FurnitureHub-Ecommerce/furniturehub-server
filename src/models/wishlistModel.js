/*
 * @Author: Minh Truong
 *
 * Mục đích:
 * Định nghĩa cấu trúc dữ liệu Wishlist.
 *
 * Một bản ghi Wishlist thể hiện việc một khách hàng
 * đã thêm một sản phẩm vào danh sách yêu thích.
 *
 * Quy tắc:
 * 1. Mỗi Wishlist phải thuộc về một User.
 * 2. Mỗi Wishlist phải tham chiếu đến một Product.
 * 3. Một User không được yêu thích trùng một Product.
 * 4. Tự động lưu thời gian tạo và cập nhật.
 */

const mongoose = require("mongoose");

const wishlistSchema = new mongoose.Schema(
  {
    // Xác định khách hàng sở hữu mục yêu thích.
    // Tham chiếu đến _id của User.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Xác định sản phẩm được yêu thích.
    // Tham chiếu đến _id của Product.
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
  },
  {
    // Tự động tạo createdAt và updatedAt.
    timestamps: true,
  }
);

/*
 * Tạo unique compound index cho userId và productId.
 *
 * Mục đích:
 * - Ngăn một User lưu cùng một Product nhiều lần.
 * - Vẫn cho phép nhiều User yêu thích cùng một Product.
 *
 * Ví dụ:
 * User A + Product X: hợp lệ.
 * User A + Product X lần 2: bị từ chối.
 * User B + Product X: hợp lệ.
 *
 * Lưu ý:
 * Index cần được tạo thành công trên database
 * để ràng buộc unique có hiệu lực.
 */
wishlistSchema.index(
  { userId: 1, productId: 1 },
  { unique: true }
);

// Tạo Model Wishlist để thao tác với collection wishlists.
module.exports = mongoose.model("Wishlist", wishlistSchema);