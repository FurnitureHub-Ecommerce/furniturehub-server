const express = require("express");

const brandController = require("../controllers/brandController");

const authMiddleware = require("../middlewares/authMiddleware");
const authorizeRoles = require("../middlewares/roleMiddleware");
const validate = require("../middlewares/validateMiddleware");

const ROLES = require("../constants/roles");

const {
  createBrandSchema,
  updateBrandSchema,
} = require("../validators/brandValidator");

const router = express.Router();

// Public - Get active brands
router.get("/", brandController.getAll);

// Admin - Get all brands
router.get(
  "/admin",
  authMiddleware,
  authorizeRoles(ROLES.ADMIN),
  brandController.getAllAdmin
);

// Public - Brand detail
router.get("/:id", brandController.getById);

// Admin - Create brand
router.post(
  "/",
  authMiddleware,
  authorizeRoles(ROLES.ADMIN),
  validate(createBrandSchema),
  brandController.create
);

// Admin - Update brand
router.patch(
  "/:id",
  authMiddleware,
  authorizeRoles(ROLES.ADMIN),
  validate(updateBrandSchema),
  brandController.update
);

// Admin - Soft delete
router.delete(
  "/:id",
  authMiddleware,
  authorizeRoles(ROLES.ADMIN),
  brandController.remove
);

module.exports = router;