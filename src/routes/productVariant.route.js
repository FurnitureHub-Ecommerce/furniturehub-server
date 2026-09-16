/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Định nghĩa các API quản lý ProductVariant và SKU.
 *
 * Bước 1: Import Express và Controller.
 * Bước 2: Import các middleware.
 * Bước 3: Import Validator và Role.
 * Bước 4: Tạo Router cho Variant thuộc Product.
 * Bước 5: Tạo Router thao tác trực tiếp theo Variant ID.
 * Bước 6: Định nghĩa các API công khai.
 * Bước 7: Định nghĩa các API dành cho Admin.
 * Bước 8: Export hai Router để gắn vào app.js.
 *
 * Lưu ý:
 * - Product ID được lấy từ URL.
 * - Client không được tự sửa productId.
 * - SKU được quản lý trong ProductVariant.
 * - Tồn kho không được xử lý tại Route này.
 */

const express = require("express");

const variantController = require("../controllers/productVariant.controller");

const authMiddleware = require("../middlewares/auth.middleware");

const authorizeRoles = require("../middlewares/role.middleware");

const validate = require("../middlewares/validate.middleware");

const ROLES = require("../constants/roles");

const {
  createVariantSchema,
  updateVariantSchema,
} = require("../validators/productVariant.validator");

/**
 * Bước 4: Router quản lý Variant theo Product.
 *
 * mergeParams: true giúp Router truy cập được
 * productId nếu sau này được gắn như Router con
 * vào Product Router.
 */
const productVariantRouter = express.Router({
  mergeParams: true,
});

/**
 * Bước 5: Router thao tác trực tiếp theo Variant ID.
 */
const variantRouter = express.Router();

/**
 * Bước 6: Lấy danh sách Variant công khai.
 *
 * - Không yêu cầu token.
 * - Chỉ lấy Variant đang hoạt động.
 */
productVariantRouter.get(
  "/",
  variantController.getByProductId
);

/**
 * Bước 7.1: Admin xem toàn bộ Variant.
 *
 * - Xác thực JWT.
 * - Kiểm tra quyền ADMIN.
 * - Bao gồm Variant đã bị vô hiệu hóa.
 */
productVariantRouter.get(
  "/admin",
  authMiddleware,
  authorizeRoles(ROLES.ADMIN),
  variantController.getByProductIdAdmin
);

/**
 * Bước 7.2: Admin tạo Variant.
 *
 * - Xác thực JWT.
 * - Kiểm tra quyền ADMIN.
 * - Validate dữ liệu bằng Zod.
 * - Gọi Controller tạo Variant.
 */
productVariantRouter.post(
  "/",
  authMiddleware,
  authorizeRoles(ROLES.ADMIN),
  validate(createVariantSchema),
  variantController.create
);

/**
 * Bước 6: Lấy chi tiết Variant công khai.
 *
 * - Nhận ID từ URL.
 * - Không yêu cầu đăng nhập.
 */
variantRouter.get(
  "/:id",
  variantController.getById
);

/**
 * Bước 7.3: Admin cập nhật Variant.
 *
 * - Xác thực JWT.
 * - Kiểm tra quyền ADMIN.
 * - Validate dữ liệu cập nhật.
 * - Gọi Controller xử lý.
 */
variantRouter.patch(
  "/:id",
  authMiddleware,
  authorizeRoles(ROLES.ADMIN),
  validate(updateVariantSchema),
  variantController.update
);

/**
 * Bước 7.4: Admin xóa mềm Variant.
 *
 * - Xác thực JWT.
 * - Kiểm tra quyền ADMIN.
 * - Gọi Controller vô hiệu hóa Variant.
 */
variantRouter.delete(
  "/:id",
  authMiddleware,
  authorizeRoles(ROLES.ADMIN),
  variantController.remove
);

// Bước 8: Export hai Router.
module.exports = {
  productVariantRouter,
  variantRouter,
};