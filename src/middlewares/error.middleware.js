/**
 * @Author: Minh Truong
 *
 * Mục đích file:
 * Quản lý tập trung middleware xử lý lỗi (Global Error Handler) và tuyến đường không tồn tại (Not Found)
 * cho toàn bộ hệ thống FurnitureHub.
 *
 * Middleware 1: notFoundHandler
 * - Bắt tất cả các yêu cầu gửi đến endpoint không tồn tại trong hệ thống (Unknown Route).
 * - Trả về mã HTTP 404 cùng JSON message rõ ràng, ngăn Express tự động trả về trang HTML mặc định.
 *
 * Middleware 2: errorHandler
 * - Bắt và chuẩn hóa toàn bộ exception/lỗi phát sinh từ các tầng Controller, Service và Middleware.
 * - Xử lý lỗi cú pháp JSON từ express.json (entity.parse.failed) -> trả về HTTP 400.
 * - Xử lý lỗi validation từ thư viện Zod (ZodError) -> trả về HTTP 400 kèm chi tiết các trường lỗi.
 * - Xử lý lỗi CastError từ Mongoose khi client truyền định dạng ID không hợp lệ -> trả về HTTP 400.
 * - Xử lý lỗi ValidationError từ Mongoose -> trả về HTTP 400.
 * - Xử lý lỗi trùng lặp khóa duy nhất từ MongoDB (MongoServerError mã 11000):
 *   + Trùng email người dùng -> trả về HTTP 400 "Email already exists" để tương thích ngược.
 *   + Trùng các trường tài nguyên khác (tên danh mục, thương hiệu, SKU) -> trả về HTTP 409.
 * - Phản hồi các lỗi nghiệp vụ đã được gắn statusCode trước đó (400, 401, 403, 404, 409, 503).
 * - Với lỗi hệ thống hoặc ngoại lệ ngoài ý muốn (HTTP 500):
 *   + Trả về thông báo chung "Internal server error".
 *   + Tuyệt đối không rò rỉ stack trace, chuỗi kết nối database (Mongo URI) hay JWT secret ra client.
 */

const { ZodError } = require("zod");

/**
 * Middleware xử lý khi client gọi đến route không tồn tại trong hệ thống.
 *
 * @param {import("express").Request} req - Express Request
 * @param {import("express").Response} res - Express Response
 */
const notFoundHandler = (req, res) => {
  return res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
};

/**
 * Middleware xử lý lỗi toàn cục cho ứng dụng Express.
 *
 * @param {Error} err - Đối tượng lỗi phát sinh
 * @param {import("express").Request} req - Express Request
 * @param {import("express").Response} res - Express Response
 * @param {import("express").NextFunction} next - Express NextFunction
 */
const errorHandler = (err, req, res, next) => {
  // Ghi log lỗi nội bộ trên server để phục vụ debug và giám sát hệ thống
  console.error(`[Error Handler] ${req.method} ${req.originalUrl}:`, err);

  // 1. Xử lý lỗi phân tích cú pháp JSON body không hợp lệ (SyntaxError từ express.json)
  if (err.type === "entity.parse.failed" || (err instanceof SyntaxError && "body" in err)) {
    return res.status(400).json({
      message: "Invalid JSON body",
    });
  }

  // 2. Xử lý lỗi xác thực dữ liệu từ thư viện Zod (ZodError)
  if (err instanceof ZodError || err.name === "ZodError") {
    return res.status(400).json({
      message: "Validation failed",
      errors: err.issues || err.errors,
    });
  }

  // 3. Xử lý lỗi Mongoose CastError khi giá trị ObjectId không đúng định dạng 24 hex
  if (err.name === "CastError") {
    return res.status(400).json({
      message: `Invalid ${err.path || "ID"} format`,
    });
  }

  // 4. Xử lý lỗi xác thực schema của Mongoose (ValidationError)
  if (err.name === "ValidationError") {
    return res.status(400).json({
      message: err.message || "Database validation failed",
    });
  }

  // 5. Xử lý lỗi trùng lặp chỉ mục duy nhất trong MongoDB (Unique Index Violation - code 11000)
  if (err.code === 11000) {
    const duplicateField = Object.keys(err.keyPattern || err.keyValue || {})[0];

    // Đối với email người dùng, trả HTTP 400 để duy trì tính tương thích với frontend và nghiệp vụ auth
    if (duplicateField === "email") {
      return res.status(400).json({
        message: "Email already exists",
      });
    }

    // Đối với các tài nguyên nghiệp vụ khác (Category, Brand, SKU), trả HTTP 409 Conflict
    return res.status(409).json({
      message: `${duplicateField ? duplicateField.charAt(0).toUpperCase() + duplicateField.slice(1) : "Field"} already exists`,
    });
  }

  // 6. Xử lý các lỗi nghiệp vụ đã được định nghĩa statusCode (400, 401, 403, 404, 409, 503)
  const statusCode = err.statusCode && Number.isInteger(err.statusCode) && err.statusCode >= 400 && err.statusCode < 600
    ? err.statusCode
    : 500;

  // Lỗi hệ thống 500: ẩn hoàn toàn stack trace và thông tin nội bộ
  if (statusCode === 500) {
    return res.status(500).json({
      message: "Internal server error",
    });
  }

  // Các lỗi client 4xx: trả thông điệp lỗi rõ ràng cùng chi tiết (nếu có)
  const responsePayload = {
    message: err.message || "An error occurred",
  };

  if (err.details) {
    responsePayload.details = err.details;
  }

  if (err.errors) {
    responsePayload.errors = err.errors;
  }

  return res.status(statusCode).json(responsePayload);
};

module.exports = {
  notFoundHandler,
  errorHandler,
};
