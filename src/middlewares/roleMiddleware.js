/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Middleware phân quyền (Role-based Authorization) theo vai trò của người dùng.
 *
 * Hoạt động:
 * 1. Kiểm tra req.user (được gán từ authMiddleware trước đó):
 *    - Nếu chưa có req.user -> trả về HTTP 401 Unauthorized.
 * 2. So sánh role của người dùng (req.user.role) với danh sách allowedRoles:
 *    - Nếu role không nằm trong danh sách cho phép -> trả về HTTP 403 "Forbidden: insufficient permission".
 *    - Nếu role hợp lệ -> gọi next() cho phép tiếp tục thực thi.
 *
 * Ví dụ sử dụng:
 * authorizeRoles(ROLES.ADMIN): Chỉ ADMIN mới được truy cập.
 * authorizeRoles(ROLES.STAFF, ROLES.ADMIN): STAFF và ADMIN được truy cập.
 */

const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: "Forbidden: insufficient permission",
      });
    }

    next();
  };
};

module.exports = authorizeRoles;