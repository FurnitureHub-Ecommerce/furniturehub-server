/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Khởi tạo ứng dụng Express và đăng ký các API FurnitureHub.
 *
 * Bước 1: Import Express và các Router.
 * Bước 2: Import CORS và Swagger.
 * Bước 3: Khởi tạo ứng dụng Express.
 * Bước 4: Cấu hình middleware xử lý JSON và CORS.
 * Bước 5: Đăng ký các API.
 * Bước 6: Cấu hình Swagger với thanh tìm kiếm.
 * Bước 7: Export ứng dụng cho server.js.
 */

const express = require("express");
const cors = require("cors");

// Import các Router hiện tại của FurnitureHub.
const categoryRoute = require("./routes/category.route");
const authRoute = require("./routes/auth.route");
const userRoute = require("./routes/user.route");
const brandRoute = require("./routes/brand.route");
const productRoute = require("./routes/product.route");

// Import Router quản lý Wishlist.
const wishlistRoute = require("./routes/wishlist.route");

// Import Router quản lý Cart.
const cartRoute = require("./routes/cart.route");

// Import Router quản lý Address.
const addressRoute = require("./routes/address.route");

// Import Router kiểm tra điều kiện checkout.
const checkoutRoute = require("./routes/checkout.route");

// Tạo và xem chi tiết đơn hàng của Customer.
const orderRoute = require("./routes/order.route");

// Payment: Customer tạo và xem Payment theo orderId.
const orderPaymentRoute = require("./routes/orderPayment.route");

// Payment: STAFF/ADMIN xác nhận trạng thái Payment.
const paymentRoute = require("./routes/payment.route");
const inventoryRoute = require("./routes/inventory.route");

// Import hai Router quản lý ProductVariant.
// File productVariant.route.js đang export hai Router riêng.
const {
  productVariantRouter,
  variantRouter,
} = require("./routes/productVariant.route");

// Import Swagger UI và tài liệu OpenAPI.
const {
  swaggerUi,
  swaggerSpec,
} = require("./config/swagger");

// Khởi tạo ứng dụng Express.
const app = express();

/**
 * Cấu hình middleware xử lý JSON.
 *
 * Cho phép Backend đọc dữ liệu JSON từ request body.
 * Middleware phải được đăng ký trước các API routes.
 */
app.use(express.json());

/**
 * API kiểm tra trạng thái Backend.
 */
app.get("/", (req, res) => {
  res.json({
    message: "FurnitureHub API is running",
  });
});

/**
 * Cấu hình CORS.
 *
 * - Cho phép React Web chạy trên localhost:5173.
 * - Cho phép các phương thức HTTP cần thiết.
 * - Cho phép Content-Type và Authorization header.
 * - Phải đăng ký trước các API routes.
 */
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
    ],

    methods: [
      "GET",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
    ],
  })
);

/**
 * Đăng ký các API của FurnitureHub.
 *
 * Express sẽ kết hợp đường dẫn trong app.use()
 * với đường dẫn được khai báo trong từng Router.
 */

// Authentication.
app.use("/api/auth", authRoute);

// Category.
app.use("/api/categories", categoryRoute);

// Brand.
app.use("/api/brands", brandRoute);

// Product.
app.use("/api/products", productRoute);

// Wishlist dành cho Customer.
app.use("/api/wishlist", wishlistRoute);

// Cart dành cho Customer.
app.use("/api/cart", cartRoute);

// Address dành cho Customer.
app.use("/api/addresses", addressRoute);

// Kiểm tra địa chỉ và giỏ hàng trước khi Customer tiếp tục checkout.
app.use("/api/checkout", checkoutRoute);

// Order lưu địa chỉ và giá tại thời điểm đặt hàng.
app.use("/api/orders", orderRoute);

// Payment: Customer tạo và xem Payment gắn với Order.
// Mount với mergeParams để nhận orderId từ URL parent.
app.use("/api/orders/:orderId/payment", orderPaymentRoute);

// Payment: STAFF/ADMIN xác nhận hoặc hủy trạng thái Payment.
app.use("/api/payments", paymentRoute);
app.use("/api/inventory", inventoryRoute);

// User: ADMIN tạo tài khoản nhân viên (STAFF hoặc STORAGE_MANAGER).
app.use("/api/users", userRoute);

/**
 * Lỗi JSON xảy ra trước Router; trả 400 dạng JSON cho Order và Inventory.
 * Không để Express trả trang lỗi chứa stack khi body bị hỏng hoặc là null.
 * Các lỗi khác tiếp tục đi theo cơ chế xử lý hiện tại của ứng dụng.
 */
app.use(["/api/orders", "/api/inventory", "/api/users"], (error, req, res, next) => {
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ message: "Invalid JSON body" });
  }
  return next(error);
});

/**
 * ProductVariant.
 *
 * Router thứ nhất xử lý biến thể theo sản phẩm.
 * Router thứ hai xử lý từng biến thể theo ID.
 *
 * Các tiền tố này áp dụng khi đường dẫn bên trong
 * productVariant.route.js là các đường dẫn tương đối.
 */
app.use(
  "/api/products/:productId/variants",
  productVariantRouter
);

app.use("/api/variants", variantRouter);

/**
 * Cấu hình Swagger UI.
 *
 * Bước 1: Hiển thị tài liệu tại /api-docs.
 * Bước 2: Bật thanh lọc API.
 * Bước 3: Thu gọn các nhóm API khi mở trang.
 * Bước 4: Sắp xếp các nhóm và endpoint theo tên.
 *
 * Không thay đổi màu sắc Swagger.
 */
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    swaggerOptions: {
      filter: true,
      docExpansion: "none",
      tagsSorter: "alpha",
      operationsSorter: "alpha",
    },
  })
);

// Export Express App để server.js sử dụng.
module.exports = app;
