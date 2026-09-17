const express = require("express");


const categoryRoute = require("./routes/category.route");
const authRoute = require("./routes/auth.route");
const brandRoute = require("./routes/brand.route");
const productRoute = require("./routes/product.route");
const app = express();

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