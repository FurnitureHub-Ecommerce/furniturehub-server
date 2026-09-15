const { z } = require("zod");

const registerSchema = z.object({
  fullName: z
    .string()
    .min(2, "Full name must be at least 2 characters")
    .max(100, "Full name is too long"),

  email: z
    .string()
    .email("Invalid email format"),

  password: z
    .string()
    .min(6, "Password must be at least 6 characters"),

  phone: z
    .string()
    .min(9, "Phone number is invalid")
    .max(15, "Phone number is invalid")
    .optional(),
});

const loginSchema = z.object({
  email: z
    .string()
    .email("Invalid email format"),

  password: z
    .string()
    .min(1, "Password is required"),
});

module.exports = {
  registerSchema,
  loginSchema,
};