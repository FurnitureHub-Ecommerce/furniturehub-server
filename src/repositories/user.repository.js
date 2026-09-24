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

const User = require("../models/User.model");

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
  findByEmail,
  findById,
  createUser,
};