/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Định nghĩa validator cho ADMIN tạo nhân viên và CUSTOMER cập nhật hồ sơ.
 *
 * Nghiệp vụ:
 * - ADMIN chỉ được phép tạo tài khoản có vai trò STAFF hoặc STORAGE_MANAGER.
 * - Tuyệt đối không cho phép tạo CUSTOMER hoặc ADMIN qua API này.
 * - Kiểm tra tính hợp lệ của fullName, email, password (tối thiểu 6 ký tự), phone và role.
 * - Nếu role không hợp lệ, trả về HTTP 400 kèm thông báo rõ ràng:
 *   "Admin can only create STAFF or STORAGE_MANAGER accounts"
 */

const { z } = require("zod");
const ROLES = require("../constants/roles");

// Danh sách các role được phép tạo bởi ADMIN
const ALLOWED_ADMIN_CREATED_ROLES = [ROLES.STAFF, ROLES.STORAGE_MANAGER];

// Schema Zod kiểm tra dữ liệu tạo người dùng của ADMIN
const createUserSchema = z.object({
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

  role: z
    .enum(ALLOWED_ADMIN_CREATED_ROLES, {
      message: "Admin can only create STAFF or STORAGE_MANAGER accounts",
    }),
});

/**
 * Middleware kiểm tra dữ liệu đầu vào khi ADMIN tạo user mới.
 * - Sử dụng createUserSchema để kiểm tra toàn bộ trường.
 * - Bắt riêng lỗi role để trả đúng định dạng message theo yêu cầu nghiệp vụ:
 *   "Admin can only create STAFF or STORAGE_MANAGER accounts"
 */
const validateCreateUser = (req, res, next) => {
  const result = createUserSchema.safeParse(req.body);

  if (!result.success) {
    // Tìm lỗi đầu tiên liên quan đến trường role nếu có
    const roleIssue = result.error.issues.find((issue) =>
      issue.path.includes("role")
    );

    if (roleIssue) {
      return res.status(400).json({
        message: "Admin can only create STAFF or STORAGE_MANAGER accounts",
        errors: result.error.issues,
      });
    }

    // Nếu là lỗi của các trường khác (fullName, email, password...)
    return res.status(400).json({
      message: result.error.issues[0]?.message || "Validation failed",
      errors: result.error.issues,
    });
  }

  // Gán lại req.body với dữ liệu đã được parse sạch bởi Zod
  req.body = result.data;
  next();
};

// Dùng cùng quy tắc tên/phone với tạo tài khoản, nhưng chỉ cho sửa hai trường này.
const updateProfileSchema = createUserSchema.pick({ fullName: true, phone: true })
  .partial()
  .strict()
  .refine((data) => Object.keys(data).length > 0, "At least one field is required");

/**
 * Profile chỉ xác định người dùng từ JWT, không nhận query hoặc body của GET.
 * Từ chối cả userId lẫn trường lạ để không tạo cảm giác client có thể chọn tài khoản.
 * Body PATCH được kiểm tra riêng bằng updateProfileSchema.
 */
const emptyProfileInputSchema = z.object({}).strict();
const validateProfileRequest = (req, res, next) => {
  const queryResult = emptyProfileInputSchema.safeParse(req.query);
  const bodyResult = req.method === "GET"
    ? emptyProfileInputSchema.optional().safeParse(req.body)
    : { success: true };
  const result = !queryResult.success ? queryResult : bodyResult;
  if (!result.success) {
    return res.status(400).json({ message: "Validation failed", errors: result.error.issues });
  }
  return next();
};

module.exports = {
  createUserSchema,
  validateCreateUser,
  ALLOWED_ADMIN_CREATED_ROLES,
  updateProfileSchema,
  validateProfileRequest,
};
