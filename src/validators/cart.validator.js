/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Kiểm tra dữ liệu đầu vào cho Cart API.
 *
 * Bước 1: Import Zod.
 * Bước 2: Định nghĩa schema cho request thêm CartItem.
 * Bước 3: Định nghĩa schema cho request cập nhật số lượng.
 * Bước 4: Export các schema cho Route sử dụng.
 *
 * Lưu ý:
 * - userId KHÔNG được nhận từ request body.
 *   userId phải lấy từ JWT (req.user.userId) để tránh thao tác giỏ hàng người khác.
 * - unitPrice KHÔNG được nhận từ Frontend.
 *   Backend tự lấy giá từ ProductVariant để tránh gian lận giá.
 * - Việc kiểm tra Variant tồn tại, isActive, và tồn kho
 *   sẽ do Cart Service đảm nhiệm sau khi Validator thông qua.
 */

const { z } = require("zod");

/**
 * Bước 2: Schema thêm sản phẩm vào giỏ hàng.
 *
 * Client chỉ được gửi hai trường:
 * - variantId: ID của ProductVariant cần thêm vào giỏ.
 * - quantity: Số lượng cần thêm, phải là số nguyên dương.
 *
 * variantId phải là chuỗi 24 ký tự hexadecimal (MongoDB ObjectId).
 * quantity phải là số nguyên, tối thiểu là 1.
 * quantity tối đa sẽ do Service kiểm tra với tồn kho thực tế.
 */
const addItemSchema = z.object({
  variantId: z
    .string({
      error: "Variant ID must be a string",
    })
    .regex(/^[a-fA-F0-9]{24}$/, {
      message: "Invalid variant ID",
    }),

  quantity: z
    .number({
      error: "Quantity must be a number",
    })
    /*
     * Ép kiểu số nguyên.
     * Từ chối các giá trị thập phân như 1.5, 2.3.
     * Khách hàng không thể thêm nửa chiếc ghế vào giỏ hàng.
     */
    .int({
      message: "Quantity must be an integer",
    })
    /*
     * Số lượng tối thiểu là 1.
     * Không cho phép thêm 0 hoặc số âm vào giỏ hàng.
     */
    .min(1, {
      message: "Quantity must be at least 1",
    }),
});

/**
 * Bước 3: Schema cập nhật số lượng CartItem.
 *
 * Client chỉ được gửi quantity mới.
 * itemId lấy từ URL (:itemId), không nhận từ body.
 *
 * Quantity mới phải là số nguyên dương.
 * Service sẽ kiểm tra quantity không vượt tồn kho.
 *
 * Không hỗ trợ cập nhật variantId vì thay đổi Variant
 * tương đương xóa item cũ và thêm item mới.
 */
const updateItemSchema = z.object({
  quantity: z
    .number({
      error: "Quantity must be a number",
    })
    .int({
      message: "Quantity must be an integer",
    })
    .min(1, {
      message: "Quantity must be at least 1",
    }),
});

// Bước 4: Export các schema cho Route sử dụng.
module.exports = {
  addItemSchema,
  updateItemSchema,
};
