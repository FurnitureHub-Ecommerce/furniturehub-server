/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Kiểm tra dữ liệu đầu vào khi tạo và cập nhật Product.
 *
 * Bước 1: Import thư viện Zod.
 * Bước 2: Tạo schema kiểm tra ObjectId của MongoDB.
 * Bước 3: Tạo schema cho chức năng thêm Product.
 * Bước 4: Tạo schema cho chức năng cập nhật Product.
 * Bước 5: Export các schema để route sử dụng.
 *
 * Quy tắc:
 * - Tên sản phẩm không được để trống.
 * - Category và Brand phải có ObjectId hợp lệ.
 * - Images phải là mảng các chuỗi không rỗng.
 * - Không cho client tự thêm các trường ngoài schema.
 * - Không nhận price, SKU hoặc quantity trong Product.
 */

const { z } = require("zod");

// Bước 2: Kiểm tra định dạng ObjectId gồm 24 ký tự hex.
const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId");

// Bước 3: Kiểm tra dữ liệu khi tạo Product.
const createProductSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Product name is required"),

  description: z.string().trim().optional(),

  categoryId: objectIdSchema,

  brandId: objectIdSchema,

  images: z.array(
    z.string().trim().min(1, "Image cannot be empty")
  ).optional(),
}).strict();

// Bước 4: Cho phép cập nhật từng trường.
//
// isActive chỉ được sử dụng khi cập nhật Product.
// Ví dụ: Admin kích hoạt lại sản phẩm đã vô hiệu hóa.
const updateProductSchema = createProductSchema
  .extend({
    isActive: z.boolean().optional(),
  })
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    "At least one field is required"
  );

// Bước 5: Export schema.
module.exports = {
  createProductSchema,
  updateProductSchema,
};