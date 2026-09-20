/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Định nghĩa các API quản lý Wishlist cho Customer.
 *
 * Bước 1: Import Express và Wishlist Controller.
 * Bước 2: Import Middleware xác thực và phân quyền.
 * Bước 3: Import Validator và danh sách Role.
 * Bước 4: Khởi tạo Express Router.
 * Bước 5: Đăng ký API lấy Wishlist.
 * Bước 6: Đăng ký API thêm sản phẩm.
 * Bước 7: Đăng ký API xóa sản phẩm.
 * Bước 8: Export Router.
 */

const express = require("express");

const wishlistController = require("../controllers/wishlist.controller");

const authMiddleware = require("../middlewares/auth.middleware");

const authorizeRoles = require("../middlewares/role.middleware");

const validate = require("../middlewares/validate.middleware");

const ROLES = require("../constants/roles");

const {
  addWishlistSchema,
} = require("../validators/wishlist.validator");

// Bước 4: Khởi tạo Router.
const router = express.Router();

/**
 * Bước 5: API lấy danh sách yêu thích.
 *
 * - Xác thực JWT.
 * - Chỉ cho phép CUSTOMER truy cập.
 * - Controller lấy userId từ req.user.
 * - Trả danh sách Wishlist của chính Customer.
 */
router.get(
  "/",
  authMiddleware,
  authorizeRoles(ROLES.CUSTOMER),
  wishlistController.getAll
);

/**
 * Bước 6: API thêm sản phẩm yêu thích.
 *
 * - Xác thực JWT.
 * - Chỉ cho phép CUSTOMER.
 * - Validate productId từ request body.
 * - Gọi Controller để thêm Wishlist.
 */
router.post(
  "/",
  authMiddleware,
  authorizeRoles(ROLES.CUSTOMER),
  validate(addWishlistSchema),
  wishlistController.add
);

/**
 * Bước 7: API xóa sản phẩm yêu thích.
 *
 * - Xác thực JWT.
 * - Chỉ cho phép CUSTOMER.
 * - Nhận productId từ URL.
 * - Service kiểm tra ID và xóa đúng bản ghi.
 */
router.delete(
  "/:productId",
  authMiddleware,
  authorizeRoles(ROLES.CUSTOMER),
  wishlistController.remove
);

// Bước 8: Export Router.
module.exports = router;