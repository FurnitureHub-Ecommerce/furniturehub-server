/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Đăng ký API xác nhận / cập nhật trạng thái Payment (dành cho STAFF và ADMIN).
 *
 * Endpoint được đăng ký:
 * PATCH /api/payments/:paymentId/status — STAFF/ADMIN xác nhận hoặc hủy Payment.
 *
 * Phân quyền:
 * - authMiddleware: kiểm tra JWT, gắn req.user.
 * - authorizeRoles(ROLES.STAFF, ROLES.ADMIN): chỉ STAFF và ADMIN được gọi.
 *   CUSTOMER trả 403 — không cho phép Customer tự đánh dấu đơn đã thanh toán.
 *   STORAGE (Storage Manager) trả 403 — role này chỉ quản lý kho.
 *
 * Validate:
 * - updatePaymentStatusSchema: chỉ nhận status ("paid"/"cancelled") và note tùy chọn.
 *   Không nhận: userId, amount, orderId, paymentMethod.
 *
 * Lưu ý:
 * Router này được mount vào app.js tại "/api/payments".
 * Endpoint đầy đủ: PATCH /api/payments/:paymentId/status.
 *
 * Xác nhận thanh toán là thao tác thủ công sau khi nhân viên đã kiểm tra thực tế:
 * - COD: đã thu tiền khi giao hàng.
 * - BANK_TRANSFER: đã đối soát giao dịch chuyển khoản.
 * Không cho phép xác nhận tự động mà không có kiểm tra thực tế.
 */

const express = require("express");
const paymentController = require("../controllers/payment.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const authorizeRoles = require("../middlewares/role.middleware");
const validate = require("../middlewares/validate.middleware");
const ROLES = require("../constants/roles");
const { updatePaymentStatusSchema } = require("../validators/payment.validator");

const router = express.Router();

/**
 * Áp dụng authMiddleware và authorizeRoles cho tất cả route trong file này.
 * - authMiddleware: trả 401 nếu thiếu hoặc sai JWT.
 * - authorizeRoles(ROLES.STAFF, ROLES.ADMIN): trả 403 nếu không phải STAFF/ADMIN.
 *   CUSTOMER bị ngăn tại đây, không thể gọi endpoint xác nhận thanh toán.
 */
router.use(authMiddleware, authorizeRoles(ROLES.STAFF, ROLES.ADMIN));

/**
 * PATCH /api/payments/:paymentId/status
 *
 * STAFF/ADMIN xác nhận hoặc hủy Payment sau khi kiểm tra thực tế.
 * validate(updatePaymentStatusSchema): kiểm tra req.body chỉ chứa status và note.
 * Controller lấy confirmerId từ JWT (req.user.userId) để lưu truy vết.
 * Trả 200 kèm Payment đã cập nhật khi thành công.
 */
router.patch(
  "/:paymentId/status",
  validate(updatePaymentStatusSchema),
  paymentController.updatePaymentStatus
);

module.exports = router;
