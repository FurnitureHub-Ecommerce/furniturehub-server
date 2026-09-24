/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Cung cấp logic nghiệp vụ xác thực người dùng (Auth Service): Đăng ký và Đăng nhập.
 *
 * Nghiệp vụ đăng ký (register):
 * - Dành riêng cho khách hàng (CUSTOMER) tự tạo tài khoản.
 * - Chuẩn hóa email thành chữ thường và cắt khoảng trắng thừa.
 * - Kiểm tra email đã tồn tại trong cơ sở dữ liệu chưa (trả lỗi nếu trùng).
 * - Hash mật khẩu bằng thư viện bcryptjs với salt round 10 để bảo mật.
 * - BẮT BUỘC gán role cố định là ROLES.CUSTOMER:
 *   Tuyệt đối không cho phép client tự chỉ định role (STAFF, STORAGE_MANAGER, ADMIN).
 *   Ngay cả khi client cố tình truyền role trong request body, hệ thống vẫn lưu là CUSTOMER.
 */

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const userRepository = require("../repositories/user.repository");
const ROLES = require("../constants/roles");

/**
 * Đăng ký tài khoản khách hàng mới.
 *
 * @param {Object} userData - Dữ liệu đăng ký từ client (fullName, email, password, phone)
 * @returns {Promise<Object>} User document vừa được tạo trong MongoDB
 */
const register = async (userData) => {
  // Chuẩn hóa email
  const email = userData.email.toLowerCase().trim();

  // Kiểm tra trùng email
  const existingUser = await userRepository.findByEmail(email);
  if (existingUser) {
    const error = new Error("Email already exists");
    error.statusCode = 400;
    throw error;
  }

  // Băm mật khẩu với bcryptjs (salt round = 10)
  const hashedPassword = await bcrypt.hash(userData.password, 10);

  // Tạo người dùng mới trong database:
  // Cố định role là ROLES.CUSTOMER, tuyệt đối không nhận role từ client
  const newUser = await userRepository.createUser({
    fullName: userData.fullName.trim(),
    email: email,
    password: hashedPassword,
    phone: userData.phone ? userData.phone.trim() : undefined,
    role: ROLES.CUSTOMER,
  });

  return newUser;
};

/**
 * Đăng nhập hệ thống và tạo JWT token.
 *
 * @param {string} email - Email đăng nhập
 * @param {string} password - Mật khẩu người dùng
 * @returns {Promise<Object>} Object chứa user và token
 */
const login = async (email, password) => {
  const normalizedEmail = email.toLowerCase().trim();

  // Tìm người dùng theo email
  const user = await userRepository.findByEmail(normalizedEmail);
  if (!user) {
    throw new Error("Invalid email or password");
  }

  // Kiểm tra tài khoản có bị khóa/vô hiệu hóa không
  if (!user.isActive) {
    throw new Error("Account is inactive");
  }

  // Đối chiếu mật khẩu đã băm
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new Error("Invalid email or password");
  }

  // Ký JSON Web Token (chứa userId và role)
  const token = jwt.sign(
    {
      userId: user._id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    }
  );

  return {
    user,
    token,
  };
};

module.exports = {
  register,
  login,
};