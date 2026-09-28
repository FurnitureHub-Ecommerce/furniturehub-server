/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Định nghĩa các tuyến đường (Router) cho User API trong FurnitureHub.
 *
 * Phân quyền và bảo mật:
 * - API POST /api/users:
 *   1. authMiddleware: Bắt buộc người dùng phải đăng nhập và gửi Access Token (Bearer JWT).
 *      Nếu không có token hoặc token không hợp lệ -> trả về HTTP 401.
 *   2. authorizeRoles(ROLES.ADMIN): Chỉ tài khoản có vai trò ADMIN mới được phép truy cập.
 *      Các vai trò khác (CUSTOMER, STAFF, STORAGE_MANAGER) -> trả về HTTP 403 Forbidden.
 *   3. validateCreateUser: Middleware kiểm tra dữ liệu body bằng Zod.
 *      Chỉ cho phép role là STAFF hoặc STORAGE_MANAGER.
 *   4. userController.createUser: Xử lý tạo người dùng và trả về kết quả 201 Created.
 */

const express = require("express");

const userController = require("../controllers/userController");
const authMiddleware = require("../middlewares/authMiddleware");
const authorizeRoles = require("../middlewares/roleMiddleware");
const ROLES = require("../constants/roles");
const validate = require("../middlewares/validateMiddleware");
const { validateCreateUser, updateProfileSchema, validateProfileRequest } = require("../validators/userValidator");

const router = express.Router();

// Profile của CUSTOMER đăng nhập; phân quyền riêng từng route để giữ quyền ADMIN tạo nhân viên.
router.get(
  "/profile",
  authMiddleware,
  authorizeRoles(ROLES.CUSTOMER),
  validateProfileRequest,
  userController.getProfile
);

router.patch(
  "/profile",
  authMiddleware,
  authorizeRoles(ROLES.CUSTOMER),
  validateProfileRequest,
  validate(updateProfileSchema),
  userController.updateProfile
);

/**
 * Route: POST /api/users
 * Quyền: Chỉ ADMIN (authMiddleware + authorizeRoles(ROLES.ADMIN))
 * Chức năng: Tạo tài khoản nhân viên (STAFF hoặc STORAGE_MANAGER)
 */
router.post(
  "/",
  authMiddleware,
  authorizeRoles(ROLES.ADMIN),
  validateCreateUser,
  userController.createUser
);

module.exports = router;
