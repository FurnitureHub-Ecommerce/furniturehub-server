/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Kiểm tra dữ liệu đầu vào khi thêm sản phẩm vào Wishlist.
 *
 * Bước 1: Import Zod.
 * Bước 2: Định nghĩa schema cho request thêm Wishlist.
 * Bước 3: Kiểm tra productId là ObjectId hợp lệ.
 * Bước 4: Export schema cho Route sử dụng.
 */

const { z } = require("zod");

/**
 * Bước 2: Định nghĩa dữ liệu thêm Wishlist.
 *
 * Client chỉ được gửi productId.
 * userId phải lấy từ JWT, không nhận từ request body.
 *
 * Product ID cần là chuỗi gồm 24 ký tự hexadecimal.
 * Việc kiểm tra Product tồn tại và isActive
 * sẽ do Wishlist Service đảm nhiệm.
 */
const addWishlistSchema = z.object({
  productId: z
    .string({
      error: "Product ID must be a string",
    })
    .regex(/^[a-fA-F0-9]{24}$/, {
      message: "Invalid product ID",
    }),
});

// Bước 4: Export schema cho Route sử dụng.
module.exports = {
  addWishlistSchema,
};