/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Controller xử lý quản trị User và hồ sơ của CUSTOMER đang đăng nhập.
 *
 * Chức năng:
 * - getProfile/updateProfile: CUSTOMER xem và sửa tên/phone của chính mình.
 * - createUser: ADMIN tạo tài khoản nhân viên (STAFF hoặc STORAGE_MANAGER).
 *   + Nhận dữ liệu đã qua xác thực từ request body.
 *   + Gọi userService.createUser() để xử lý nghiệp vụ tạo tài khoản.
 *   + Trả về HTTP 201 Created kèm dữ liệu user (tuyệt đối không trả mật khẩu).
 *   + Bắt và xử lý lỗi (ví dụ: email đã tồn tại, role không hợp lệ) trả về HTTP status tương ứng (400).
 */

const userService = require("../services/user.service");

// Lỗi Profile trả JSON theo convention; không gửi lỗi database hoặc stack ra client.
const handleProfileError = (res, error) => {
  const statusCode = [400, 401, 403, 404].includes(error.statusCode) ? error.statusCode : 500;
  return res.status(statusCode).json({
    message: statusCode === 500 ? "Internal server error" : error.message,
  });
};

// Chỉ lấy userId do authMiddleware cung cấp, không đọc ID từ query/body.
const getProfile = async (req, res) => {
  try {
    const user = await userService.getProfile(req.user.userId);
    return res.status(200).json({ user });
  } catch (error) {
    return handleProfileError(res, error);
  }
};

const updateProfile = async (req, res) => {
  try {
    const user = await userService.updateProfile(req.user.userId, req.body);
    return res.status(200).json({ message: "Profile updated successfully", user });
  } catch (error) {
    return handleProfileError(res, error);
  }
};

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
    // Xử lý lỗi trùng email khi có xung đột ghi đồng thời (MongoServerError 11000)
    if (error.code === 11000) {
      return res.status(400).json({
        message: "Email already exists",
      });
    }

    // Nếu có mã statusCode do service ném ra (ví dụ 400 khi role sai hoặc email đã tồn tại)
    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return res.status(error.statusCode).json({
        message: error.message,
      });
    }

    // Lỗi hệ thống ngoài dự kiến: trả về HTTP 500 chuẩn hóa, không rò rỉ stack trace
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};

module.exports = {
  createUser,
  getProfile,
  updateProfile,
};
