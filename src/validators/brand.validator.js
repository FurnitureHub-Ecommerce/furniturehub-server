//zod là một thư viện TypeScript-first schema declaration and validation library. Nó cho phép bạn xác định các schema dữ liệu và thực hiện xác thực dữ liệu một cách dễ dàng và mạnh mẽ. Zod cung cấp các phương thức để xác định các kiểu dữ liệu, kiểm tra tính hợp lệ của dữ liệu, và tạo ra các thông báo lỗi tùy chỉnh khi dữ liệu không hợp lệ.

const { z } = require("zod");

const createBrandSchema = z.object({
  name: z.string().trim().min(1, "Brand name is required"),

  description: z.string().trim().optional(),
}).strict();

const updateBrandSchema = createBrandSchema
  .partial()
  .refine(
    (data) => Object.keys(data).length > 0,
    "At least one field is required"
  );

module.exports = {
  createBrandSchema,
  updateBrandSchema,
};