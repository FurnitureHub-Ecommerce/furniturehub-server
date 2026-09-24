const express = require("express");
const inventoryController = require("../controllers/inventory.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const authorizeRoles = require("../middlewares/role.middleware");
const validate = require("../middlewares/validate.middleware");
const ROLES = require("../constants/roles");
const {
  validateVariantId,
  stockMovementSchema,
  stockAdjustmentSchema,
  stockThresholdSchema,
} = require("../validators/inventory.validator");

const router = express.Router();
// Xác thực trước khi đọc lịch sử; chỉ STORAGE_MANAGER và ADMIN được xem dữ liệu kho.
// CUSTOMER/STAFF bị chặn tại đây, trước khi xử lý query hoặc truy vấn lịch sử.
router.use(authMiddleware, authorizeRoles(ROLES.STORAGE_MANAGER, ROLES.ADMIN));
const manageStock = authorizeRoles(ROLES.STORAGE_MANAGER);

// ADMIN chỉ xem kho; STORAGE_MANAGER được xem và quyết định các thay đổi tồn kho.
// Các đường dẫn cố định phải đứng trước /:variantId.
router.get("/", inventoryController.getAll);
router.get("/low-stock", inventoryController.getLowStock);
// Đặt trước /:variantId để transactions được nhận là tên API, không bị hiểu thành ID variant.
router.get("/transactions", inventoryController.getTransactions);
router.get("/:variantId", validateVariantId, inventoryController.getByVariantId);
router.post("/:variantId/import", manageStock, validateVariantId, validate(stockMovementSchema), inventoryController.importStock);
router.post("/:variantId/export", manageStock, validateVariantId, validate(stockMovementSchema), inventoryController.exportStock);
router.patch("/:variantId/adjust", manageStock, validateVariantId, validate(stockAdjustmentSchema), inventoryController.adjustStock);
router.patch("/:variantId/threshold", manageStock, validateVariantId, validate(stockThresholdSchema), inventoryController.updateThreshold);

module.exports = router;
