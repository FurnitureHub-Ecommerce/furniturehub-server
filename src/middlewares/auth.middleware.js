/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Middleware xác thực người dùng bằng JSON Web Token (JWT).
 *
 * Hoạt động:
 * 1. Đọc Authorization header từ request (`Bearer <token>`).
 * 2. Nếu thiếu header hoặc không đúng định dạng -> trả về HTTP 401 "Access token is required".
 * 3. Giải mã và verify token bằng JWT_SECRET:
 *    - Token hợp lệ: gán thông tin payload decoded { userId, role } vào req.user.
 *    - Token không hợp lệ hoặc hết hạn: trả về HTTP 401 "Invalid or expired token".
 * 4. Gọi next() để chuyển tiếp sang middleware/controller tiếp theo.
 */

const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Access token is required",
      });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = {
      userId: decoded.userId,
      role: decoded.role,
    };

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
};

module.exports = authMiddleware;