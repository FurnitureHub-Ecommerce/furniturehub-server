/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Định nghĩa schema validation cho các chức năng xác thực người dùng (Auth).
 *
 * Lưu ý nghiệp vụ quan trọng:
 * - registerSchema chỉ dành cho việc khách hàng tự đăng ký tài khoản (CUSTOMER).
 * - registerSchema cố ý KHÔNG khai báo trường `role` để ngăn chặn client tự chọn vai trò (ví dụ: gửi role: ADMIN hoặc STAFF).
 * - Khi parse qua Zod, mọi trường lạ ngoài schema (như role) đều bị loại bỏ tự động.
 * - Logic gán role: CUSTOMER được thực hiện cứng tại auth.service.js.
 */

const { z } = require("zod");

// Schema kiểm tra dữ liệu đăng ký tài khoản khách hàng (CUSTOMER)
const registerSchema = z.object({
  fullName: z
    .string({ required_error: "Full name is required" })
    .trim()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name is too long"),

  email: z
    .string({ required_error: "Email is required" })
    .trim()
    .email("Invalid email format"),

  password: z
    .string({ required_error: "Password is required" })
    .min(6, "Password must be at least 6 characters"),

  phone: z
    .string()
    .trim()
    .min(9, "Phone number is invalid")
    .max(15, "Phone number is invalid")
    .optional(),
});

// Schema kiểm tra dữ liệu đăng nhập
const loginSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .trim()
    .email("Invalid email format"),

  password: z
    .string({ required_error: "Password is required" })
    .min(1, "Password is required"),
});

module.exports = {
  registerSchema,
  loginSchema,
};