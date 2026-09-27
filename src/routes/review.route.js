const express = require("express");
const controller = require("../controllers/review.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const authorizeRoles = require("../middlewares/role.middleware");
const validate = require("../middlewares/validate.middleware");
const ROLES = require("../constants/roles");
const { createReviewSchema, updateReviewSchema, validateReviewId } = require("../validators/review.validator");

const router = express.Router();

// Danh sách public; mọi thao tác ghi chỉ dành cho CUSTOMER đã xác thực JWT.
router.get("/product/:productId", validateReviewId("productId"), controller.getByProduct);
router.use(authMiddleware, authorizeRoles(ROLES.CUSTOMER));
router.post("/", validate(createReviewSchema), controller.create);
router.patch("/:id", validateReviewId("id"), validate(updateReviewSchema), controller.update);
router.delete("/:id", validateReviewId("id"), controller.remove);

module.exports = router;
