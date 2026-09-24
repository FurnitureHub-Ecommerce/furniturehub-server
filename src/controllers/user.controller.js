/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Controller xử lý các request HTTP liên quan đến quản trị User (User Controller).
 *
 * Chức năng:
 * - createUser: ADMIN tạo tài khoản nhân viên (STAFF hoặc STORAGE_MANAGER).
 *   + Nhận dữ liệu đã qua xác thực từ request body.
 *   + Gọi userService.createUser() để xử lý nghiệp vụ tạo tài khoản.
 *   + Trả về HTTP 201 Created kèm dữ liệu user (tuyệt đối không trả mật khẩu).
 *   + Bắt và xử lý lỗi (ví dụ: email đã tồn tại, role không hợp lệ) trả về HTTP status tương ứng (400).
 */

const userService = require("../services/user.service");

/**
 * Endpoint xử lý ADMIN tạo tài khoản STAFF hoặc STORAGE_MANAGER.
 * POST /api/users
 *
 * @param {Object} req - Express Request object
 * @param {Object} res - Express Response object
 */
const createUser = async (req, res) => {
  try {
    // Gọi tầng service để thực hiện logic tạo tài khoản nhân viên
    const newUser = await userService.createUser(req.body);

    // Trả về HTTP 201 Created theo đúng định dạng yêu cầu của dự án
    // TUYỆT ĐỐI không trả password hay hashed password trong response
    return res.status(201).json({
      message: "User created successfully",
      user: {
        _id: newUser._id,
        fullName: newUser.fullName,
        email: newUser.email,
        phone: newUser.phone,
        role: newUser.role,
        isActive: newUser.isActive,
      },
    });
  } catch (error) {
    // Xử lý lỗi trả về cho client:
    // Nếu có statusCode (ví dụ 400 khi trùng email hoặc role không hợp lệ), dùng statusCode đó
    const statusCode = error.statusCode || 400;

    return res.status(statusCode).json({
      message: error.message,
    });
  }
};

module.exports = {
  createUser,
};
