/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Định nghĩa các API quản lý Product.
 *
 * Bước 1: Import Express và Product Controller.
 * Bước 2: Import middleware xác thực và phân quyền.
 * Bước 3: Import Validator và danh sách Role.
 * Bước 4: Khởi tạo Express Router.
 * Bước 5: Tạo API lấy danh sách Product công khai.
 * Bước 6: Tạo API lấy danh sách Product cho Admin.
 * Bước 7: Tạo API lấy chi tiết Product.
 * Bước 8: Tạo API thêm Product cho Admin.
 * Bước 9: Tạo API cập nhật Product cho Admin.
 * Bước 10: Tạo API xóa mềm Product cho Admin.
 * Bước 11: Export Router.
 */

const express = require("express");

const productController = require("../controllers/product.controller");

const authMiddleware = require("../middlewares/auth.middleware");
const authorizeRoles = require("../middlewares/role.middleware");
const validate = require("../middlewares/validate.middleware");

const ROLES = require("../constants/roles");

const {
  createProductSchema,
  updateProductSchema,
} = require("../validators/product.validator");

// Bước 4: Khởi tạo Router.
const router = express.Router();

/**
 * Bước 5: API lấy danh sách Product.
 *
 * - Không yêu cầu đăng nhập.
 * - Chỉ trả sản phẩm đang hoạt động.
 */
router.get("/", productController.getAll);

/**
 * Bước 6: API lấy toàn bộ Product cho Admin.
 *
 * - Kiểm tra JWT.
 * - Kiểm tra quyền ADMIN.
 * - Lấy cả sản phẩm đã vô hiệu hóa.
 *
 * Lưu ý:
 * Route /admin phải khai báo trước /:id.
 */
router.get(
  "/admin",
  authMiddleware,
  authorizeRoles(ROLES.ADMIN),
  productController.getAllAdmin
);

/**
 * Bước 7: API lấy chi tiết Product.
 *
 * - Nhận ID từ URL.
 * - Không yêu cầu đăng nhập.
 * - Chỉ cho xem Product đang hoạt động.
 */
router.get("/:id", productController.getById);

/**
 * Bước 8: API tạo Product.
 *
 * - Xác thực JWT.
 * - Kiểm tra quyền ADMIN.
 * - Validate request body bằng Zod.
 * - Chuyển request đến Controller.
 */
router.post(
  "/",
  authMiddleware,
  authorizeRoles(ROLES.ADMIN),
  validate(createProductSchema),
  productController.create
);

/**
 * Bước 9: API cập nhật Product.
 *
 * - Xác thực JWT.
 * - Kiểm tra quyền ADMIN.
 * - Validate dữ liệu cần cập nhật.
 * - Gọi Controller xử lý.
 */
router.patch(
  "/:id",
  authMiddleware,
  authorizeRoles(ROLES.ADMIN),
  validate(updateProductSchema),
  productController.update
);

/**
 * Bước 10: API xóa mềm Product.
 *
 * - Xác thực JWT.
 * - Kiểm tra quyền ADMIN.
 * - Nhận ID từ URL.
 * - Gọi Controller để vô hiệu hóa Product.
 */
router.delete(
  "/:id",
  authMiddleware,
  authorizeRoles(ROLES.ADMIN),
  productController.remove
);

// Bước 11: Export Router.
module.exports = router;