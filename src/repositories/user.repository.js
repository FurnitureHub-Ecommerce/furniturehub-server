const User = require("../models/User.model");

const findByEmail = async (email) => {
  return await User.findOne({ email });
};

const findById = async (id) => {
  return await User.findById(id);
};

const createUser = async (userData) => {
  return await User.create(userData);
};

module.exports = {
  findByEmail,
  findById,
  createUser,
};