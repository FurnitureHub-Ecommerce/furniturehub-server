/**
 * @Author: Minh Truong
 *
 * Mục đích file:
 * Định nghĩa schema Zod và middleware kiểm tra tính hợp lệ của query parameters cho Dashboard API.
 *
 * Nghiệp vụ và luồng xác thực:
 * 1. Endpoint GET /api/dashboard/statistics là API thống kê tổng hợp toàn hệ thống.
 * 2. Nếu client gửi kèm tham số lọc thời gian (from, to), kiểm tra:
 *    - from: chuỗi thời gian định dạng ISO 8601 hợp lệ (nếu có).
 *    - to: chuỗi thời gian định dạng ISO 8601 hợp lệ (nếu có).
 *    - from không được lớn hơn to (nếu cả hai cùng được cung cấp).
 * 3. Áp dụng .strict() để ngăn chặn các tham số lạ không được hỗ trợ (chống injection hoặc tham số không xác định).
 * 4. Nếu kiểm tra thất bại, trả về HTTP 400 kèm thông báo lỗi chi tiết.
 * 5. Nếu hợp lệ, gán dữ liệu đã chuẩn hóa vào req.query và gọi next() để tiếp tục xử lý.
 */

const { z } = require("zod");

// Schema kiểm tra query parameters của Dashboard API
const dashboardQuerySchema = z
  .object({
    from: z
      .string()
      .datetime({ message: "Invalid date format for 'from'. Expected ISO 8601 string." })
      .optional(),
    to: z
      .string()
      .datetime({ message: "Invalid date format for 'to'. Expected ISO 8601 string." })
      .optional(),
  })
  .strict()
  .refine(
    (data) => !data.from || !data.to || new Date(data.from) <= new Date(data.to),
    {
      message: "'from' date must not be later than 'to' date",
      path: ["to"],
    }
  );

/**
 * Middleware kiểm tra dữ liệu query parameters trước khi vào Dashboard Controller.
 *
 * @param {import("express").Request} req - Express Request
 * @param {import("express").Response} res - Express Response
 * @param {import("express").NextFunction} next - Express NextFunction
 */
const validateDashboardQuery = (req, res, next) => {
  const result = dashboardQuerySchema.safeParse(req.query);

  if (!result.success) {
    return res.status(400).json({
      message: result.error.issues[0]?.message || "Validation failed",
      errors: result.error.issues,
    });
  }

  req.query = result.data;
  return next();
};

module.exports = {
  dashboardQuerySchema,
  validateDashboardQuery,
};
