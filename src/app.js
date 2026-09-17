const express = require("express");



const categoryRoute = require("./routes/category.route");
const authRoute = require("./routes/auth.route");
const brandRoute = require("./routes/brand.route");
const productRoute = require("./routes/product.route");
const app = express();
// Import middleware CORS để cho phép Frontend truy cập API.
const cors = require("cors");
/**
 * Import Swagger UI và tài liệu OpenAPI
 * để cung cấp giao diện xem và thử API.
 */
const {
  swaggerUi: swaggerUi,
  swaggerSpec,
}= require("./config/swagger");

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "FurnitureHub API is running",
  });
});


/*
 * Cấu hình CORS cho FurnitureHub.
 *
 * Mục đích:
 * - Cho phép React Web đang chạy trên localhost:5173 gọi API.
 * - Cho phép các phương thức HTTP cần thiết.
 * - Cho phép gửi JSON và JWT qua Authorization header.
 *
 * Middleware này phải được khai báo trước các API routes.
 */

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use("/api/auth", authRoute);
app.use("/api/categories", categoryRoute);
app.use("/api/brands", brandRoute);
app.use("/api/products", productRoute);



/**
 * Tạo đường dẫn Swagger UI.
 *
 * Bước 1: Nhận request tại /api-docs.
 * Bước 2: Sử dụng swagger-ui-express để hiển thị.
 * Bước 3: Truyền swaggerSpec vào giao diện.
 */
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec)
);

module.exports = app;