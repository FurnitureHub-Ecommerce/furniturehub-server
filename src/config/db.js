/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Kết nối FurnitureHub Backend với MongoDB bằng Mongoose.
 * Cho phép lựa chọn MongoDB Local hoặc MongoDB Atlas.
 *
 * Bước 1: Import thư viện mongoose.
 * Bước 2: Tạo hàm bất đồng bộ connectDB.
 * Bước 3: Đọc DB_MODE từ biến môi trường.
 * Bước 4: Kiểm tra DB_MODE có hợp lệ không.
 * Bước 5: Chọn URI tương ứng với chế độ kết nối.
 * Bước 6: Kiểm tra URI có tồn tại hay không.
 * Bước 7: Kết nối MongoDB bằng mongoose.connect().
 * Bước 8: Thông báo kết nối thành công.
 * Bước 9: Nếu xảy ra lỗi, thông báo và dừng server.
 * Bước 10: Export hàm connectDB.
 */

const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    // Bước 3: Đọc chế độ kết nối, mặc định sử dụng Local.
    const dbMode = process.env.DB_MODE || "local";

    // Bước 4: Chỉ chấp nhận hai chế độ local và atlas.
    if (!["local", "atlas"].includes(dbMode)) {
      throw new Error("DB_MODE must be local or atlas");
    }

    // Bước 5: Chọn URI theo chế độ đã cấu hình.
    const mongoURI =
      dbMode === "local"
        ? process.env.MONGODB_URI_LOCAL
        : process.env.MONGODB_URI_ATLAS;

    // Bước 6: Kiểm tra URI trước khi kết nối.
    if (!mongoURI) {
      throw new Error(`MongoDB URI for ${dbMode} is missing`);
    }

    // Bước 7: Thực hiện kết nối MongoDB.
    const conn = await mongoose.connect(mongoURI);

    // Bước 8: Thông báo kết nối thành công.
    console.log(
      `MongoDB Connected (${dbMode}): ${conn.connection.host}`
    );
  } catch (error) {
    // Bước 9: Thông báo lỗi và dừng server.
    console.error(`MongoDB connection error: ${error.message}`);

    process.exit(1);
  }
};

// Bước 10: Export hàm để server.js sử dụng.
module.exports = connectDB;