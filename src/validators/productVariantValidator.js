/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Kiểm tra dữ liệu đầu vào khi tạo và cập nhật
 * biến thể sản phẩm.
 *
 * Bước 1: Import thư viện Zod.
 * Bước 2: Tạo schema kiểm tra SKU.
 * Bước 3: Tạo schema kiểm tra thông tin Variant.
 * Bước 4: Tạo schema cho chức năng tạo Variant.
 * Bước 5: Tạo schema cho chức năng cập nhật Variant.
 * Bước 6: Export các schema.
 *
 * Quy tắc:
 * - SKU không được để trống.
 * - SKU được chuẩn hóa thành chữ in hoa.
 * - Giá phải là số không âm.
 * - Color, size và material có thể không được cung cấp.
 * - Không cho client thay đổi productId khi cập nhật.
 * - Không nhận quantity vì tồn kho thuộc Inventory.
 */

const { z } = require("zod");

/**
 * Bước 2: Tạo schema kiểm tra SKU.
 *
 * - Nhận chuỗi SKU.
 * - Loại bỏ khoảng trắng đầu và cuối.
 * - Chuyển SKU thành chữ in hoa.
 * - Kiểm tra SKU không được rỗng.
 */
const skuSchema = z
  .string()
  .trim()
  .min(1, "SKU is required")
  .transform((value) => value.toUpperCase());

/**
 * Bước 3: Tạo schema thông tin Variant.
 *
 * - Kiểm tra màu sắc, kích thước và chất liệu.
 * - Các thuộc tính này không bắt buộc.
 * - Kiểm tra giá là số không âm và hữu hạn.
 */
const variantFieldsSchema = z.object({
  sku: skuSchema,

  color: z.string().trim().optional(),

  size: z.string().trim().optional(),

  material: z.string().trim().optional(),

  price: z
    .number()
    .finite()
    .nonnegative("Price cannot be negative"),
}).strict();

/**
 * Bước 4: Schema tạo Variant.
 *
 * - SKU và price là bắt buộc.
 * - productId sẽ được lấy từ URL.
 * - Không cho phép thêm field ngoài schema.
 */
const createVariantSchema = variantFieldsSchema;

/**
 * Bước 5: Schema cập nhật Variant.
 *
 * - Cho phép cập nhật từng thuộc tính.
 * - Cho phép thay đổi trạng thái isActive.
 * - Phải cung cấp ít nhất một field.
 */
const updateVariantSchema = variantFieldsSchema
  .extend({
    isActive: z.boolean().optional(),
  })
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    "At least one field is required"
  );

// Bước 6: Export schema cho Route.
module.exports = {
  createVariantSchema,
  updateVariantSchema,
};