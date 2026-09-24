/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Controller xử lý các request liên quan đến Authentication (Đăng ký, Đăng nhập).
 *
 * Chức năng:
 * 1. register:
 *    - Nhận dữ liệu đăng ký từ client (đã qua middleware validate registerSchema).
 *    - Gọi authService.register() để tạo tài khoản CUSTOMER.
 *    - Trả về mã HTTP 201 Created cùng thông tin user (tuyệt đối không trả mật khẩu).
 *    - Nếu có lỗi (ví dụ email trùng), trả về HTTP 400 cùng message lỗi.
 *
 * 2. login:
 *    - Nhận email và password từ client.
 *    - Gọi authService.login() để kiểm tra và lấy JWT token.
 *    - Trả về mã HTTP 200 OK cùng token và thông tin user.
 *    - Nếu thông tin sai, trả về HTTP 401 Unauthorized.
 */

const authService = require("../services/auth.service");

/**
 * Xử lý đăng ký tài khoản khách hàng (CUSTOMER).
 * POST /api/auth/register
 */
const register = async (req, res) => {
  try {
    const user = await authService.register(req.body);

    return res.status(201).json({
      message: "Register successfully",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (error) {
    const statusCode = error.statusCode || 400;
    return res.status(statusCode).json({
      message: error.message,
    });
  }
};

/**
 * Xử lý đăng nhập hệ thống.
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const result = await authService.login(email, password);

    return res.status(200).json({
      message: "Login successfully",
      token: result.token,
      user: {
        id: result.user._id,
        fullName: result.user.fullName,
        email: result.user.email,
        phone: result.user.phone,
        role: result.user.role,
      },
    });
  } catch (error) {
    return res.status(401).json({
      message: error.message,
    });
  }
};

module.exports = {
  register,
  login,
};