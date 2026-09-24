/**
 * @Author: Minh Truong
 * Mục đích: đăng ký API tạo, xem và kiểm soát trạng thái Order.
 * Bước 1: Xác thực JWT bằng middleware hiện tại (401).
 * Bước 2: POST/GET giữ quyền CUSTOMER; PATCH status/confirm/reject chỉ STAFF/ADMIN (403).
 * CUSTOMER được hủy đơn của mình qua PATCH cancel theo quyền sẵn có.
 * Bước 3: PATCH kiểm tra ID trước body bằng Zod (400), rồi gọi Controller.
 * Bước 4: Service kiểm tra tồn tại (404), thiếu hàng (400), quy tắc (409), transaction (503).
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

// Xác nhận đơn: chỉ STAFF và ADMIN. Không cần body; chỉ cần Order ID hợp lệ.
// Tái sử dụng validateOrderId middleware của Task 1 để kiểm tra định dạng ObjectId.
router.patch(
  "/:id/confirm",
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  validateOrderId,
  orderController.confirmOrder
);

// Từ chối đơn pending/confirmed: chỉ STAFF và ADMIN; Service tự hoàn kho nếu đã trừ.
// Tái sử dụng validateOrderId middleware của Task 1 để kiểm tra định dạng ObjectId.
router.patch(
  "/:id/reject",
  authorizeRoles(ROLES.STAFF, ROLES.ADMIN),
  validateOrderId,
  orderController.rejectOrder
);

// Hủy đơn theo quyền hiện có: CUSTOMER, STAFF, ADMIN.
// - CUSTOMER chỉ được hủy Order của chính mình (kiểm tra ở Service bằng req.user.userId).
// - STORAGE_MANAGER (và STORAGE) không có quyền hủy đơn hàng (bị từ chối với 403 Forbidden).
// - Không cần body; chỉ cần Order ID hợp lệ trên URL (validate qua validateOrderId).
router.patch(
  "/:id/cancel",
  authorizeRoles(ROLES.CUSTOMER, ROLES.STAFF, ROLES.ADMIN),
  validateOrderId,
  orderController.cancelOrder
);

// Giữ nguyên phân quyền các API Customer và Router Payment được gắn sau Router này.
router.use(authorizeRoles(ROLES.CUSTOMER));
router.post("/", validate(createOrderSchema), orderController.createOrder);
router.get("/:id", orderController.getOrderById);

module.exports = router;
