const express = require("express");
const controller = require("../controllers/reviewController");
const authMiddleware = require("../middlewares/authMiddleware");
const authorizeRoles = require("../middlewares/roleMiddleware");
const validate = require("../middlewares/validateMiddleware");
const ROLES = require("../constants/roles");
const { createReviewSchema, updateReviewSchema, validateReviewId } = require("../validators/reviewValidator");

const router = express.Router();

// Danh sách public; mọi thao tác ghi chỉ dành cho CUSTOMER đã xác thực JWT.
router.get("/product/:productId", validateReviewId("productId"), controller.getByProduct);
router.use(authMiddleware, authorizeRoles(ROLES.CUSTOMER));
router.post("/", validate(createReviewSchema), controller.create);
router.patch("/:id", validateReviewId("id"), validate(updateReviewSchema), controller.update);
router.delete("/:id", validateReviewId("id"), controller.remove);

module.exports = router;
