/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Tầng nghiệp vụ (Service Layer) quản lý người dùng FurnitureHub.
 * Cung cấp chức năng cho phép ADMIN tạo tài khoản nhân viên (STAFF, STORAGE_MANAGER).
 *
 * Các bước xử lý trong hàm createUser:
 * Bước 1: Kiểm tra tính hợp lệ của vai trò (role). Chỉ chấp nhận STAFF hoặc STORAGE_MANAGER.
 * Bước 2: Chuẩn hóa email (viết thường, bỏ khoảng trắng thừa).
 * Bước 3: Kiểm tra email đã tồn tại trong hệ thống chưa (trả lỗi 400 nếu đã tồn tại).
 * Bước 4: Băm mật khẩu (hash password) bằng bcryptjs với salt rounds = 10, tuyệt đối không lưu plain-text.
 * Bước 5: Gọi UserRepository để tạo bản ghi người dùng mới trong collection `users`.
 * Bước 6: Trả về thông tin người dùng vừa tạo (loại bỏ trường password nhạy cảm).
 */

const bcrypt = require("bcryptjs");
const userRepository = require("../repositories/user.repository");
const ROLES = require("../constants/roles");

/**
 * Tạo tài khoản nhân viên bởi ADMIN.
 *
 * @param {Object} userData - Dữ liệu người dùng cần tạo (fullName, email, password, phone, role)
 * @returns {Promise<Object>} Document User mới tạo trong MongoDB
 */
const createUser = async (userData) => {
  // Bước 1: Kiểm tra vai trò (Role Validation)
  // ADMIN chỉ được phép tạo tài khoản có quyền STAFF hoặc STORAGE_MANAGER
  // Không cho phép tạo ADMIN hoặc CUSTOMER qua API này
  const allowedRoles = [ROLES.STAFF, ROLES.STORAGE_MANAGER];
  if (!allowedRoles.includes(userData.role)) {
    const error = new Error("Admin can only create STAFF or STORAGE_MANAGER accounts");
    error.statusCode = 400;
    throw error;
  }

  // Bước 2: Chuẩn hóa email
  const normalizedEmail = userData.email.toLowerCase().trim();

  // Bước 3: Kiểm tra email đã tồn tại chưa (Email Check)
  const existingUser = await userRepository.findByEmail(normalizedEmail);
  if (existingUser) {
    const error = new Error("Email already exists");
    error.statusCode = 400;
    throw error;
  }

  // Bước 4: Băm mật khẩu (Hash Password)
  // Tái sử dụng logic hash giống register hiện tại bằng bcryptjs (salt round = 10)
  const hashedPassword = await bcrypt.hash(userData.password, 10);

  // Bước 5: Tạo người dùng mới trong MongoDB (Create User)
  const newUser = await userRepository.createUser({
    fullName: userData.fullName.trim(),
    email: normalizedEmail,
    password: hashedPassword,
    phone: userData.phone ? userData.phone.trim() : undefined,
    role: userData.role,
  });

  // Bước 6: Trả về user vừa tạo
  return newUser;
};

module.exports = {
  createUser,
};
