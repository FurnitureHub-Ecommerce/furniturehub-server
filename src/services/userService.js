/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Tầng nghiệp vụ (Service Layer) quản lý người dùng FurnitureHub.
 * Cung cấp chức năng cho phép ADMIN tạo tài khoản nhân viên (STAFF, STORAGE_MANAGER).
 * CUSTOMER được đọc hồ sơ và cập nhật fullName/phone qua các hàm Profile riêng.
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
const userRepository = require("../repositories/userRepository");
const ROLES = require("../constants/roles");

const getAllUsers = () => userRepository.findAll();

const profileError = (message, statusCode) => Object.assign(new Error(message), { statusCode });

/**
 * Đọc hồ sơ bằng userId từ JWT và projection an toàn tại Repository.
 * ID trong token sai trả 401, tài khoản không tồn tại trả 404.
 * Kiểm tra trạng thái/role hiện tại để token cũ không truy cập sau khi tài khoản bị khóa.
 * Chỉ áp dụng cho Profile, không thay đổi luồng Auth dùng chung.
 */
const getProfile = async (userId) => {
  if (typeof userId !== "string" || !/^[a-fA-F0-9]{24}$/.test(userId)) {
    throw profileError("Invalid user ID in token", 401);
  }
  const user = await userRepository.findProfileById(userId);
  if (!user) throw profileError("User not found", 404);
  if (!user.isActive || user.role !== ROLES.CUSTOMER) {
    throw profileError("Profile is only available to active customers", 403);
  }
  return user;
};

/**
 * Kiểm tra tài khoản từ JWT trước khi ghi; chỉ chọn fullName và phone đã qua Zod.
 * Không truyền nguyên body xuống MongoDB, nên role/email/password/isActive không thể bị sửa.
 * Trả hồ sơ mới qua projection an toàn; Address được quản lý ở API riêng.
 */
const updateProfile = async (userId, data) => {
  await getProfile(userId);
  const changes = {};
  if (data.fullName !== undefined) changes.fullName = data.fullName;
  if (data.phone !== undefined) changes.phone = data.phone;
  const user = await userRepository.updateProfileById(userId, changes);
  if (!user) throw profileError("User is no longer available for profile update", 404);
  return user;
};

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
  getAllUsers,
  createUser,
  getProfile,
  updateProfile,
};
