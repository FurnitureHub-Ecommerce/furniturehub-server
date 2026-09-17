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

  
/**
 * Bước 6: Kiểm tra query parameters khi lấy danh sách sản phẩm.
 *
 * - search: từ khóa tìm kiếm.
 * - categoryId: lọc theo danh mục.
 * - brandId: lọc theo thương hiệu.
 * - minPrice, maxPrice: khoảng giá.
 * - sort: kiểu sắp xếp.
 * - page: trang hiện tại, bắt đầu từ 1.
 * - limit: số sản phẩm mỗi trang, tối đa 100.
 *
 * Dữ liệu từ URL có dạng chuỗi nên cần chuyển
 * các tham số số thành Number trước khi sử dụng.
 */

const productQuerySchema = z.object({
  search: z.string().trim().optional(),

  categoryId: objectIdSchema.optional(),

  brandId: objectIdSchema.optional(),

  minPrice: z.coerce.number().finite().min(0).optional(),

  maxPrice: z.coerce.number().finite().min(0).optional(),

  sort: z.enum([
    "newest",
    "oldest",
    "name_asc",
    "name_desc",
    "price_asc",
    "price_desc",
  ]).default("newest"),

  page: z.coerce.number()
    .int()
    .min(1)
    .default(1),

  limit: z.coerce.number()
    .int()
    .min(1)
    .max(100)
    .default(10),

}).strict().refine(
  (data) =>
    data.minPrice === undefined ||
    data.maxPrice === undefined ||
    data.minPrice <= data.maxPrice,
  {
    message: "minPrice must be less than or equal to maxPrice",
    path: ["maxPrice"],
  }
);

// Export schema.
module.exports = {
  createProductSchema,
  updateProductSchema,
  productQuerySchema,
};