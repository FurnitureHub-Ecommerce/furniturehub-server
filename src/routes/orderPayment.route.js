/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Đăng ký các Payment API gắn với Order (dành cho CUSTOMER).
 *
 * Endpoints được đăng ký:
 * POST /api/orders/:orderId/payment — Customer tạo Payment cho Order của mình.
 * GET  /api/orders/:orderId/payment — Customer xem Payment của Order mình.
 *
 * Phân quyền:
 * - authMiddleware: kiểm tra JWT, gắn req.user.userId và req.user.role.
 * - authorizeRoles(ROLES.CUSTOMER): chỉ CUSTOMER được gọi; STAFF/ADMIN trả 403.
 *
 * Validate:
 * - POST: validate req.body bằng createPaymentSchema (chỉ nhận paymentMethod).
 * - GET: không cần validate body; orderId được kiểm tra ở Service trước khi query.
 *
 * Lưu ý:
 * Router này được mount vào app.js tại "/api/orders".
 * Express ghép prefix "/api/orders" với path "/:orderId/payment" trong Router.
 * Kết quả là: /api/orders/:orderId/payment.
 *
 * Không lấy userId từ body/query; chỉ dùng req.user.userId từ JWT.
 * STAFF và ADMIN xác nhận thanh toán ở payment.route.js riêng.
 */

const express = require("express");
const paymentController = require("../controllers/payment.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const authorizeRoles = require("../middlewares/role.middleware");
const validate = require("../middlewares/validate.middleware");
const ROLES = require("../constants/roles");
const { createPaymentSchema } = require("../validators/payment.validator");

const router = express.Router({ mergeParams: true });

/**
 * Áp dụng authMiddleware và authorizeRoles cho tất cả route trong file này.
 * - authMiddleware: trả 401 nếu thiếu hoặc sai JWT.
 * - authorizeRoles(ROLES.CUSTOMER): trả 403 nếu role không phải CUSTOMER.
 */
router.use(authMiddleware, authorizeRoles(ROLES.CUSTOMER));

/**
 * POST /api/orders/:orderId/payment
 *
 * Customer tạo Payment cho Order của mình.
 * validate(createPaymentSchema): kiểm tra req.body chỉ chứa paymentMethod hợp lệ.
 * Trả 201 khi tạo thành công hoặc khi Payment idempotent đã tồn tại.
 */
router.post("/", validate(createPaymentSchema), paymentController.createPayment);

/**
 * GET /api/orders/:orderId/payment
 *
 * Customer xem trạng thái Payment của Order mình.
 * Không cần validate body; orderId được kiểm tra ở Service.
 * Trả 200 khi tìm thấy Payment, 404 nếu chưa tạo hoặc không phải của Customer.
 */
router.get("/", paymentController.getPayment);

module.exports = router;
