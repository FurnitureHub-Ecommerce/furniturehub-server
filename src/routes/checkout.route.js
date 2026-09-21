/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Đăng ký API kiểm tra điều kiện checkout dành riêng cho CUSTOMER.
 *
 * Bước 1: Import Controller, schema Zod và middleware hiện tại.
 * Bước 2: Khởi tạo Router và gắn chuỗi middleware cho POST /validate.
 * Bước 3: Export Router để app.js gắn tại /api/checkout.
 */

const express = require("express");
const checkoutController = require("../controllers/checkout.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const authorizeRoles = require("../middlewares/role.middleware");
const validate = require("../middlewares/validate.middleware");
const ROLES = require("../constants/roles");
const { validateCheckoutSchema } = require("../validators/checkout.validator");

const router = express.Router();

/**
 * POST /api/checkout/validate nhận body chỉ gồm addressId.
 * Xác thực JWT trước (401), kiểm tra role CUSTOMER (403), rồi kiểm tra body (400).
 * Controller chỉ chạy khi cả ba bước thành công, trả 200 nếu đủ điều kiện.
 * Cart lỗi trả 400; địa chỉ không tồn tại hoặc không thuộc Customer trả 404.
 * Lỗi hệ thống trả 500. Endpoint chỉ đọc dữ liệu, không tạo đơn hay thanh toán.
 */
router.post(
  "/validate",
  authMiddleware,
  authorizeRoles(ROLES.CUSTOMER),
  validate(validateCheckoutSchema),
  checkoutController.validateCheckout
);

module.exports = router;
