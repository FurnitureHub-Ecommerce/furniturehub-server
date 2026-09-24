/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Định nghĩa các tuyến đường xác thực người dùng (Auth Routes).
 *
 * Chức năng:
 * 1. POST /api/auth/register:
 *    - Tuyến đường public cho phép khách hàng tự đăng ký (CUSTOMER).
 *    - Sử dụng middleware validate(registerSchema) để kiểm tra tính hợp lệ dữ liệu.
 *    - Không chấp nhận client tự gán role, backend luôn tự gán role là CUSTOMER.
 *
 * 2. POST /api/auth/login:
 *    - Đăng nhập hệ thống bằng email và mật khẩu, trả về Access Token (JWT).
 */

const express = require("express");

const authController = require("../controllers/auth.controller");
const validate = require("../middlewares/validate.middleware");
const {
  registerSchema,
  loginSchema,
} = require("../validators/auth.validator");

const router = express.Router();

// Đăng ký tài khoản khách hàng (CUSTOMER)
router.post(
  "/register",
  validate(registerSchema),
  authController.register
);

// Đăng nhập hệ thống
router.post(
  "/login",
  validate(loginSchema),
  authController.login
);

module.exports = router;