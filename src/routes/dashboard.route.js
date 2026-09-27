/**
 * @Author: Minh Truong
 *
 * Mục đích file:
 * Định nghĩa tuyến đường (Route) cho Dashboard API trong hệ thống FurnitureHub.
 *
 * Yêu cầu phân quyền và bảo mật:
 * - Endpoint GET /api/dashboard/statistics CHỈ dành riêng cho tài khoản có vai trò ADMIN.
 * - Thứ tự middleware bắt buộc:
 *   1. authMiddleware: Xác thực JWT từ header Authorization (Bearer token). Nếu không có token,
 *      token không hợp lệ hoặc token hết hạn thì trả về 401 Unauthorized ngay lập tức.
 *   2. authorizeRoles(ROLES.ADMIN): Kiểm tra quyền hạn của user. Nếu role khác ADMIN
 *      (CUSTOMER, STAFF, STORAGE_MANAGER) thì chặn lại và trả về 403 Forbidden trước khi bất kỳ
 *      truy vấn thống kê dữ liệu nào được thực thi.
 *   3. dashboardController.getStatistics: Chỉ được gọi khi đã vượt qua cả hai tầng bảo mật trên.
 */

const express = require("express");
const dashboardController = require("../controllers/dashboard.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const authorizeRoles = require("../middlewares/role.middleware");
const ROLES = require("../constants/roles");
const { validateDashboardQuery } = require("../validators/dashboard.validator");

const router = express.Router();

/**
 * Route lấy dữ liệu thống kê tổng hợp toàn hệ thống:
 * - GET /api/dashboard/statistics
 * - Thứ tự middleware:
 *   1. authMiddleware: Xác thực JWT (trả 401 nếu thiếu/hết hạn token).
 *   2. authorizeRoles(ROLES.ADMIN): Phân quyền chỉ cho phép ADMIN (trả 403 nếu sai role).
 *   3. validateDashboardQuery: Kiểm tra tính hợp lệ của query parameters và khoảng ngày (trả 400 nếu sai).
 *   4. dashboardController.getStatistics: Controller tổng hợp và trả số liệu thống kê.
 */
router.get(
  "/statistics",
  authMiddleware,
  authorizeRoles(ROLES.ADMIN),
  validateDashboardQuery,
  dashboardController.getStatistics
);

module.exports = router;
