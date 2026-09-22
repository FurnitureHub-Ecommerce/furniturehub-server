/**
 * @Author: Minh Truong
 * Mục đích: đăng ký API tạo, xem và yêu cầu cập nhật trạng thái Order.
 * Bước 1: Xác thực JWT bằng middleware hiện tại (401).
 * Bước 2: POST/GET giữ quyền CUSTOMER; PATCH trạng thái chỉ STAFF/ADMIN (403).
 * Bước 3: PATCH kiểm tra ID trước body bằng Zod (400), rồi gọi Controller.
 * Bước 4: Service kiểm tra tồn tại (404), quy tắc và nghiệp vụ phụ thuộc (409).
 */
const express = require("express");
const orderController = require("../controllers/order.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const authorizeRoles = require("../middlewares/role.middleware");
const validate = require("../middlewares/validate.middleware");
const ROLES = require("../constants/roles");
const {
  createOrderSchema,
  updateOrderStatusSchema,
  validateOrderId,
} = require("../validators/order.validator");

const router = express.Router();
router.use(authMiddleware);

// Đăng ký trước nhóm CUSTOMER để STAFF/ADMIN truy cập đúng API quản trị.
// Không mở quyền hủy của Customer; quyền đó thuộc API riêng trong Task 3.
router.patch(
  "/:id/status",
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  validateOrderId,
  validate(updateOrderStatusSchema),
  orderController.updateOrderStatus
);

// Giữ nguyên phân quyền các API Customer và Router Payment được gắn sau Router này.
router.use(authorizeRoles(ROLES.CUSTOMER));
router.post("/", validate(createOrderSchema), orderController.createOrder);
router.get("/:id", orderController.getOrderById);

module.exports = router;
