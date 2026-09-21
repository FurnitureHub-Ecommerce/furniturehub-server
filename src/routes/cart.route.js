/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Định nghĩa các API quản lý giỏ hàng cho CUSTOMER.
 *
 * Bước 1: Import Express và Cart Controller.
 * Bước 2: Import Middleware xác thực và phân quyền.
 * Bước 3: Import Validator và danh sách Role.
 * Bước 4: Khởi tạo Express Router.
 * Bước 5: Đăng ký API lấy giỏ hàng.
 * Bước 6: Đăng ký API thêm sản phẩm vào giỏ hàng.
 * Bước 7: Đăng ký API cập nhật số lượng CartItem.
 * Bước 8: Đăng ký API xóa một CartItem.
 * Bước 9: Đăng ký API xóa toàn bộ giỏ hàng.
 * Bước 10: Export Router.
 *
 * Tất cả Cart API yêu cầu:
 * - JWT Authentication (authMiddleware).
 * - Role CUSTOMER (authorizeRoles).
 * - CUSTOMER chỉ thao tác được giỏ hàng của chính mình.
 *   userId luôn lấy từ JWT, không từ request.
 */

const express = require("express");

const cartController = require("../controllers/cart.controller");

const authMiddleware = require("../middlewares/auth.middleware");

const authorizeRoles = require("../middlewares/role.middleware");

const validate = require("../middlewares/validate.middleware");

const ROLES = require("../constants/roles");

const {
  addItemSchema,
  updateItemSchema,
} = require("../validators/cart.validator");

// Bước 4: Khởi tạo Router.
const router = express.Router();

/**
 * Bước 5: API lấy giỏ hàng của CUSTOMER.
 *
 * GET /api/cart
 *
 * Middleware chain:
 * 1. authMiddleware: Xác thực JWT, gắn req.user.
 * 2. authorizeRoles(CUSTOMER): Chỉ CUSTOMER được xem giỏ hàng.
 * 3. cartController.getCart: Lấy Cart và tính toán tổng tiền.
 *
 * Response 200: Cart có items + itemSubtotal + totalQuantity + totalAmount.
 * Response 200: Cart rỗng nếu chưa có item nào.
 * Response 401: Chưa đăng nhập.
 * Response 403: Không phải CUSTOMER.
 */
router.get(
  "/",
  authMiddleware,
  authorizeRoles(ROLES.CUSTOMER),
  cartController.getCart
);

/**
 * Bước 6: API thêm sản phẩm vào giỏ hàng.
 *
 * POST /api/cart/items
 *
 * Middleware chain:
 * 1. authMiddleware: Xác thực JWT, gắn req.user.
 * 2. authorizeRoles(CUSTOMER): Chỉ CUSTOMER được thêm vào giỏ.
 * 3. validate(addItemSchema): Kiểm tra variantId và quantity.
 * 4. cartController.addItem: Xử lý nghiệp vụ và trả response.
 *
 * Body yêu cầu:
 * - variantId: string, ObjectId 24 ký tự hex.
 * - quantity: number, số nguyên dương tối thiểu 1.
 *
 * Response 201: Cart đã được cập nhật.
 * Response 400: Dữ liệu không hợp lệ hoặc tồn kho không đủ.
 * Response 401: Chưa đăng nhập.
 * Response 403: Không phải CUSTOMER.
 * Response 404: Variant hoặc Product không tồn tại.
 */
router.post(
  "/items",
  authMiddleware,
  authorizeRoles(ROLES.CUSTOMER),
  validate(addItemSchema),
  cartController.addItem
);

/**
 * Bước 7: API cập nhật số lượng một CartItem.
 *
 * PATCH /api/cart/items/:itemId
 *
 * Middleware chain:
 * 1. authMiddleware: Xác thực JWT.
 * 2. authorizeRoles(CUSTOMER): Chỉ CUSTOMER được cập nhật.
 * 3. validate(updateItemSchema): Kiểm tra quantity là số nguyên dương.
 * 4. cartController.updateItem: Kiểm tra item, tồn kho và cập nhật.
 *
 * Params:
 * - itemId: _id của CartItem cần cập nhật.
 *
 * Body yêu cầu:
 * - quantity: number, số nguyên dương.
 *
 * Response 200: Cart đã được cập nhật.
 * Response 400: Quantity không hợp lệ hoặc tồn kho không đủ.
 * Response 404: CartItem không tồn tại.
 */
router.patch(
  "/items/:itemId",
  authMiddleware,
  authorizeRoles(ROLES.CUSTOMER),
  validate(updateItemSchema),
  cartController.updateItem
);

/**
 * Bước 8: API xóa một CartItem khỏi giỏ hàng.
 *
 * DELETE /api/cart/items/:itemId
 *
 * Middleware chain:
 * 1. authMiddleware: Xác thực JWT.
 * 2. authorizeRoles(CUSTOMER): Chỉ CUSTOMER được xóa.
 * 3. cartController.removeItem: Tìm và xóa đúng item.
 *
 * Params:
 * - itemId: _id của CartItem cần xóa.
 *
 * Response 200: Cart sau khi đã xóa item.
 * Response 404: CartItem không tồn tại.
 *
 * Không cần Validator vì không có body.
 * Kiểm tra định dạng itemId được thực hiện trong Service.
 */
router.delete(
  "/items/:itemId",
  authMiddleware,
  authorizeRoles(ROLES.CUSTOMER),
  cartController.removeItem
);

/**
 * Bước 9: API xóa toàn bộ giỏ hàng.
 *
 * DELETE /api/cart
 *
 * Middleware chain:
 * 1. authMiddleware: Xác thực JWT.
 * 2. authorizeRoles(CUSTOMER): Chỉ CUSTOMER được xóa.
 * 3. cartController.clearCart: Làm rỗng mảng items.
 *
 * Không cần Validator và Params.
 * Thao tác idempotent: gọi nhiều lần vẫn trả về thành công.
 * Không xóa Cart document, chỉ làm rỗng mảng items.
 *
 * Response 200: Giỏ hàng đã được làm rỗng.
 */
router.delete(
  "/",
  authMiddleware,
  authorizeRoles(ROLES.CUSTOMER),
  cartController.clearCart
);

// Bước 10: Export Router.
module.exports = router;
