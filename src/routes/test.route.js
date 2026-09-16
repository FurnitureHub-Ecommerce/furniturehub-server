const express = require("express");

const authMiddleware = require("../middlewares/auth.middleware");
const authorizeRoles = require("../middlewares/role.middleware");
const ROLES = require("../constants/roles");

const router = express.Router();

router.get(
  "/customer",
  authMiddleware,
  authorizeRoles(ROLES.CUSTOMER),
  (req, res) => {
    return res.status(200).json({
      message: "Customer route accessed successfully",
      user: req.user,
    });
  }
);

router.get(
  "/admin",
  authMiddleware,
  authorizeRoles(ROLES.ADMIN),
  (req, res) => {
    return res.status(200).json({
      message: "Admin route accessed successfully",
      user: req.user,
    });
  }
);

module.exports = router;