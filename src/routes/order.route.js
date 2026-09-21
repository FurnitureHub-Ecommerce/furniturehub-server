/**
 * @Author: Minh Truong
 * Mục đích: đăng ký POST /api/orders và GET /api/orders/:id.
 * Bước 1: Dùng JWT middleware hiện tại (401), rồi chỉ cho CUSTOMER (403).
 * Bước 2: POST kiểm tra body bằng Zod; GET kiểm tra ID tại Service (400).
 * Bước 3: Controller xử lý request; địa chỉ/đơn khác chủ trả 404, lỗi hệ thống 500.
 */
const express = require("express");
const orderController = require("../controllers/order.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const authorizeRoles = require("../middlewares/role.middleware");
const validate = require("../middlewares/validate.middleware");
const ROLES = require("../constants/roles");
const { createOrderSchema } = require("../validators/order.validator");

const router = express.Router();
router.use(authMiddleware, authorizeRoles(ROLES.CUSTOMER));
router.post("/", validate(createOrderSchema), orderController.createOrder);
router.get("/:id", orderController.getOrderById);

module.exports = router;
