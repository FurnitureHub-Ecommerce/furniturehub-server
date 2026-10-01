/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Tầng truy xuất dữ liệu (Data Access Layer / Repository) cho User Model.
 * Trực tiếp tương tác với collection `users` trong MongoDB.
 *
 * Các chức năng:
 * - findByEmail: Tìm người dùng theo địa chỉ email.
 * - findById: Tìm người dùng theo ObjectId.
 * - createUser: Tạo bản ghi người dùng mới (Customer, Staff, Storage Manager).
 */

const User = require("../models/userModel");
const ROLES = require("../constants/roles");

// Chọn danh sách field được công khai; không đọc password hay dữ liệu bảo mật vào Profile.
const PROFILE_FIELDS = "_id fullName email phone role isActive createdAt updatedAt";

const findAll = () => User.find({})
  .select(PROFILE_FIELDS)
  .sort({ createdAt: -1, _id: -1 })
  .lean();

const findProfileById = (id) => User.findById(id).select(PROFILE_FIELDS).lean();

// Điều kiện ghi giữ đúng tài khoản CUSTOMER active, kể cả khi tài khoản vừa bị khóa/đổi role.
const updateProfileById = (id, changes) => User.findOneAndUpdate(
  { _id: id, role: ROLES.CUSTOMER, isActive: true },
  { $set: changes },
  { returnDocument: "after", runValidators: true }
).select(PROFILE_FIELDS).lean();

/**
 * Tìm người dùng theo địa chỉ email.
 * @param {string} email - Địa chỉ email cần tìm
 * @returns {Promise<Object|null>} Document User hoặc null nếu không tồn tại
 */
const findByEmail = async (email) => {
  return await User.findOne({ email });
};

/**
 * Tìm người dùng theo ID MongoDB.
 * @param {string} id - ObjectId của user
 * @returns {Promise<Object|null>} Document User hoặc null nếu không tìm thấy
 */
const findById = async (id) => {
  return await User.findById(id);
};

/**
 * Tạo người dùng mới trong collection `users`.
 * @param {Object} userData - Dữ liệu người dùng (fullName, email, password, phone, role)
 * @returns {Promise<Object>} Document User vừa tạo
 */
const createUser = async (userData) => {
  return await User.create(userData);
};

module.exports = {
  findAll,
  findByEmail,
  findById,
  createUser,
  findProfileById,
  updateProfileById,
};
