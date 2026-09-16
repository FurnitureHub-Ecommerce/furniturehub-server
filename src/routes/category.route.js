const express = require("express");

const categoryController = require("../controllers/category.controller");

const authMiddleware = require("../middlewares/auth.middleware");
const authorizeRoles = require("../middlewares/role.middleware");
const validate = require("../middlewares/validate.middleware");

const ROLES = require("../constants/roles");

const {
  createCategorySchema,
  updateCategorySchema,
} = require("../validators/category.validator");

const router = express.Router();

// Public routes
router.get("/", categoryController.getAll);

// Admin - Get all categories, including inactive
router.get(
  "/admin",
  authMiddleware,
  authorizeRoles(ROLES.ADMIN),
  categoryController.getAllAdmin
);

// Public - Category detail
router.get("/:id", categoryController.getById);

// Admin - Create
router.post(
  "/",
  authMiddleware,
  authorizeRoles(ROLES.ADMIN),
  validate(createCategorySchema),
  categoryController.create
);

// Admin - Update
router.patch(
  "/:id",
  authMiddleware,
  authorizeRoles(ROLES.ADMIN),
  validate(updateCategorySchema),
  categoryController.update
);

// Admin - Soft delete
router.delete(
  "/:id",
  authMiddleware,
  authorizeRoles(ROLES.ADMIN),
  categoryController.remove
);

module.exports = router;