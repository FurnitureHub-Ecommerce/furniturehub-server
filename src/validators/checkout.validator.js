/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Kiểm tra dữ liệu đầu vào của API xác nhận điều kiện checkout.
 *
 * Bước 1: Sử dụng Zod đang có trong dự án.
 * Bước 2: Yêu cầu addressId là chuỗi ObjectId gồm 24 ký tự hex.
 * Bước 3: Từ chối mọi trường ngoài addressId và export schema cho Route.
 */

const { z } = require("zod");

/**
 * Đầu vào: body của POST /api/checkout/validate.
 * Chỉ nhận addressId; quyền sở hữu địa chỉ được Address Service kiểm tra sau.
 * Không ép kiểu hoặc bỏ qua trường lạ để tránh nhận userId, cartId, giá, tồn kho.
 * Thiếu ID, sai kiểu, sai định dạng hoặc có trường lạ đều được middleware
 * validate hiện tại trả HTTP 400 với message và danh sách lỗi Zod.
 */
const validateCheckoutSchema = z
  .object({
    addressId: z
      .string({ error: "Address ID must be a string" })
      .regex(/^[a-fA-F0-9]{24}$/, { message: "Invalid address ID" }),
  })
  .strict();

module.exports = { validateCheckoutSchema };
