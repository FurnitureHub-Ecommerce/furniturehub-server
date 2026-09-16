const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const userRepository = require("../repositories/user.repository");
const ROLES = require("../constants/roles");

const register = async (userData) => {
  const email = userData.email.toLowerCase().trim();

  const existingUser = await userRepository.findByEmail(email);

  if (existingUser) {
    throw new Error("Email already exists");
  }

  const hashedPassword = await bcrypt.hash(userData.password, 10);

  const newUser = await userRepository.createUser({
    fullName: userData.fullName,
    email: email,
    password: hashedPassword,
    phone: userData.phone,
    role: ROLES.CUSTOMER,
  });

  return newUser;
};

const login = async (email, password) => {
  const normalizedEmail = email.toLowerCase().trim();

  const user = await userRepository.findByEmail(normalizedEmail);

  if (!user) {
    throw new Error("Invalid email or password");
  }

  if (!user.isActive) {
    throw new Error("Account is inactive");
  }

  const isMatch = await bcrypt.compare(password, user.password);

  if (!isMatch) {
    throw new Error("Invalid email or password");
  }

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