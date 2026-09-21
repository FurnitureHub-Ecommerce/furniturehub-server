/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Cấu hình tài liệu Swagger cho FurnitureHub Backend.
 *
 * Bước 1: Import swagger-jsdoc và swagger-ui-express.
 * Bước 2: Khai báo thông tin hệ thống API.
 * Bước 3: Cấu hình JWT Bearer Authentication.
 * Bước 4: Định nghĩa các Schema dùng chung.
 * Bước 5: Khai báo các endpoint Auth.
 * Bước 6: Khai báo Category và Brand API.
 * Bước 7: Khai báo Product API.
 * Bước 8: Khai báo ProductVariant/SKU API.
 * Bước 9: Tạo Swagger Specification.
 * Bước 10: Export cấu hình để app.js sử dụng.
 *
 * Lưu ý:
 * Swagger chỉ mô tả API, không thay đổi logic Backend.
 */

const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");

// Bước 2: Khai báo thông tin chung.
const definition = {
  openapi: "3.0.0",

  info: {
    title: "FurnitureHub API",
    version: "1.0.0",
    description: "Tài liệu API FurnitureHub - SDN302 & MMA301",
  },

  // Sử dụng cùng origin với trang Swagger.
  // Khi deploy, Swagger sẽ gọi API trên domain Backend.
  servers: [
    {
      url: "/",
      description: "Backend hiện tại",
    },
  ],

  // Bước 3: Cấu hình JWT.
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description: "Nhập JWT nhận được từ API Login.",
      },
    },

    // Bước 4: Schema dùng chung.
    schemas: {
      Register: {
        type: "object",
        required: ["fullName", "email", "password"],
        properties: {
          fullName: {
            type: "string",
            example: "Nguyen Van A",
          },
          email: {
            type: "string",
            format: "email",
            example: "customer@example.com",
          },
          password: {
            type: "string",
            format: "password",
          },
          phone: {
            type: "string",
            example: "0912345678",
          },
        },
      },

      Login: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: {
            type: "string",
            format: "email",
          },
          password: {
            type: "string",
            format: "password",
          },
        },
      },

      Category: {
        type: "object",
        required: ["name"],
        properties: {
          name: {
            type: "string",
            example: "Living Room",
          },
          description: {
            type: "string",
            example: "Furniture for living rooms",
          },
        },
      },

      Brand: {
        type: "object",
        required: ["name"],
        properties: {
          name: {
            type: "string",
            example: "FurnitureHub",
          },
          description: {
            type: "string",
            example: "FurnitureHub furniture brand",
          },
        },
      },

      Product: {
        type: "object",
        required: ["name", "categoryId", "brandId"],
        properties: {
          name: {
            type: "string",
            example: "Sofa Milano",
          },
          description: {
            type: "string",
            example: "Modern living room sofa",
          },
          categoryId: {
            type: "string",
            example: "507f1f77bcf86cd799439011",
          },
          brandId: {
            type: "string",
            example: "507f191e810c19729de860ea",
          },
          images: {
            type: "array",
            items: {
              type: "string",
            },
          },
        },
      },

      Variant: {
        type: "object",
        required: ["sku", "price"],
        properties: {
          sku: {
            type: "string",
            example: "SOFA-MILANO-BEIGE-L",
          },
          color: {
            type: "string",
            example: "Beige",
          },
          size: {
            type: "string",
            example: "L",
          },
          material: {
            type: "string",
            example: "Fabric",
          },
          price: {
            type: "number",
            minimum: 0,
            example: 8500000,
          },
        },
      },
    },
  },

  tags: [
    { name: "Auth", description: "Xác thực người dùng" },
    { name: "Cart", description: "Quản lý giỏ hàng" },
    { name: "Category", description: "Quản lý danh mục" },
    { name: "Brand", description: "Quản lý thương hiệu" },
    { name: "Product", description: "Quản lý sản phẩm" },
    { name: "Variant", description: "Quản lý biến thể và SKU" },
    { name: "Wishlist", description: "Quản lý danh sách yêu thích" },
  ],
};

/**
 * Hàm hỗ trợ tạo request body.
 *
 * Bước 1: Nhận tên Schema.
 * Bước 2: Tham chiếu đến Schema đã định nghĩa.
 * Bước 3: Trả về cấu hình JSON request body.
 * Với PATCH, các trường đều tùy chọn nhưng body phải có ít nhất một trường.
 */
const requestBody = (schemaName, isUpdate = false, updateFields = {}) => ({
  required: true,
  content: {
    "application/json": {
      schema: isUpdate
        ? {
            type: "object",
            properties: {
              ...definition.components.schemas[schemaName].properties,
              ...updateFields,
            },
            minProperties: 1,
            additionalProperties: false,
          }
        : {
            $ref: `#/components/schemas/${schemaName}`,
          },
    },
  },
});

/**
 * Hàm hỗ trợ tạo tham số ID.
 *
 * Bước 1: Nhận tên tham số trong URL.
 * Bước 2: Đánh dấu tham số là bắt buộc.
 * Bước 3: Khai báo kiểu dữ liệu chuỗi.
 */
const idParam = (name = "id") => ({
  name,
  in: "path",
  required: true,
  schema: {
    type: "string",
    pattern: "^[0-9a-fA-F]{24}$",
  },
});

/**
 * Hàm khai báo response.
 *
 * Chỉ mô tả mã HTTP và ý nghĩa.
 * Response JSON cụ thể sẽ bổ sung theo kết quả
 * thực tế của từng Controller khi hoàn thiện tài liệu.
 */
const responses = {
  200: { description: "Thành công" },
  201: { description: "Tạo mới thành công" },
  400: { description: "Dữ liệu không hợp lệ" },
  401: { description: "Chưa xác thực" },
  403: { description: "Không đủ quyền" },
  404: { description: "Không tìm thấy dữ liệu" },
  409: { description: "Dữ liệu bị trùng hoặc xung đột" },
  500: { description: "Lỗi hệ thống" },
};

/**
 * Hàm hỗ trợ khai báo API.
 *
 * Bước 1: Nhận nhóm chức năng và mô tả.
 * Bước 2: Gắn tham số URL nếu có.
 * Bước 3: Gắn request body nếu API cần dữ liệu.
 * Bước 4: Gắn Bearer Authentication nếu cần.
 * Bước 5: Khai báo các HTTP response có thể xảy ra.
 */
const api = ({
  tag,
  summary,
  secured = false,
  params = [],
  body = null,
  success = 200,
  description,
}) => ({
  tags: [tag],
  summary,
  ...(description && { description }),
  ...(params.length > 0 && { parameters: params }),
  ...(body && { requestBody: body }),
  ...(secured && {
    security: [{ bearerAuth: [] }],
  }),
  responses: {
    [success]: responses[success],
    400: responses[400],
    ...(secured && {
      401: responses[401],
      403: responses[403],
    }),
    404: responses[404],
    409: responses[409],
    500: responses[500],
  },
});

/**
 * Bước 5-8: Khai báo toàn bộ API đã triển khai.
 *
 * Các endpoint được chia thành từng nhóm.
 * API quản lý dữ liệu yêu cầu Bearer Token ADMIN.
 * API đọc công khai không yêu cầu đăng nhập.
 */
definition.paths = {
  // ================= AUTH =================

  "/api/auth/register": {
    post: api({
      tag: "Auth",
      summary: "Đăng ký tài khoản Customer",
      body: requestBody("Register"),
      success: 201,
    }),
  },

  "/api/auth/login": {
    post: api({
      tag: "Auth",
      summary: "Đăng nhập và nhận JWT",
      body: requestBody("Login"),
    }),
  },

  // ================= CATEGORY =================

  "/api/categories": {
    get: api({
      tag: "Category",
      summary: "Lấy danh sách Category đang hoạt động",
    }),

    post: api({
      tag: "Category",
      summary: "Admin tạo Category",
      secured: true,
      body: requestBody("Category"),
      success: 201,
    }),
  },

  "/api/categories/admin": {
    get: api({
      tag: "Category",
      summary: "Admin xem tất cả Category",
      secured: true,
      description: "Bao gồm Category đã vô hiệu hóa.",
    }),
  },

  "/api/categories/{id}": {
    get: api({
      tag: "Category",
      summary: "Lấy chi tiết Category",
      params: [idParam()],
    }),

    patch: api({
      tag: "Category",
      summary: "Admin cập nhật Category",
      secured: true,
      params: [idParam()],
      body: requestBody("Category", true),
    }),

    delete: api({
      tag: "Category",
      summary: "Admin vô hiệu hóa Category",
      secured: true,
      params: [idParam()],
      description: "Soft delete thông qua isActive = false.",
    }),
  },

  // ================= BRAND =================

  "/api/brands": {
    get: api({
      tag: "Brand",
      summary: "Lấy danh sách Brand đang hoạt động",
    }),

    post: api({
      tag: "Brand",
      summary: "Admin tạo Brand",
      secured: true,
      body: requestBody("Brand"),
      success: 201,
    }),
  },

  "/api/brands/admin": {
    get: api({
      tag: "Brand",
      summary: "Admin xem tất cả Brand",
      secured: true,
    }),
  },

  "/api/brands/{id}": {
    get: api({
      tag: "Brand",
      summary: "Lấy chi tiết Brand",
      params: [idParam()],
    }),

    patch: api({
      tag: "Brand",
      summary: "Admin cập nhật Brand",
      secured: true,
      params: [idParam()],
      body: requestBody("Brand", true),
    }),

    delete: api({
      tag: "Brand",
      summary: "Admin vô hiệu hóa Brand",
      secured: true,
      params: [idParam()],
    }),
  },

  // ================= PRODUCT =================

  "/api/products": {
    get: api({
      tag: "Product",
      summary: "Lấy danh sách Product đang hoạt động",
    }),

    post: api({
      tag: "Product",
      summary: "Admin tạo Product",
      secured: true,
      body: requestBody("Product"),
      success: 201,
    }),
  },

  "/api/products/admin": {
    get: api({
      tag: "Product",
      summary: "Admin xem tất cả Product",
      secured: true,
    }),
  },

  "/api/products/{id}": {
    get: api({
      tag: "Product",
      summary: "Lấy chi tiết Product",
      params: [idParam()],
    }),

    patch: api({
      tag: "Product",
      summary: "Admin cập nhật Product",
      secured: true,
      params: [idParam()],
      body: requestBody("Product", true, {
        isActive: { type: "boolean" },
      }),
      description: "Có thể cập nhật isActive để kích hoạt lại Product.",
    }),

    delete: api({
      tag: "Product",
      summary: "Admin vô hiệu hóa Product",
      secured: true,
      params: [idParam()],
    }),
  },

  // ================= VARIANT =================

  "/api/products/{productId}/variants": {
    get: api({
      tag: "Variant",
      summary: "Lấy Variant theo Product",
      params: [idParam("productId")],
    }),

    post: api({
      tag: "Variant",
      summary: "Admin tạo Variant và SKU",
      secured: true,
      params: [idParam("productId")],
      body: requestBody("Variant"),
      success: 201,
    }),
  },

  "/api/products/{productId}/variants/admin": {
    get: api({
      tag: "Variant",
      summary: "Admin xem tất cả Variant của Product",
      secured: true,
      params: [idParam("productId")],
      description: "Bao gồm Variant đã vô hiệu hóa.",
    }),
  },

  "/api/variants/{id}": {
    get: api({
      tag: "Variant",
      summary: "Lấy chi tiết Variant",
      params: [idParam()],
    }),

    patch: api({
      tag: "Variant",
      summary: "Admin cập nhật Variant và SKU",
      secured: true,
      params: [idParam()],
      body: requestBody("Variant", true, {
        isActive: { type: "boolean" },
      }),
    }),

    delete: api({
      tag: "Variant",
      summary: "Admin vô hiệu hóa Variant",
      secured: true,
      params: [idParam()],
    }),
  },
  // ================= WISHLIST =================

  /**
   * Mục đích:
   * Khai báo tài liệu API quản lý danh sách yêu thích.
   *
   * GET: Customer lấy danh sách yêu thích.
   * POST: Customer thêm sản phẩm vào Wishlist.
   * DELETE: Customer xóa sản phẩm khỏi Wishlist.
   *
   * Cả ba API đều yêu cầu JWT.
   */
  "/api/wishlist": {
    get: api({
      tag: "Wishlist",
      summary: "Customer xem danh sách yêu thích",
      secured: true,
      description: "Lấy Wishlist của Customer đang đăng nhập.",
    }),

    post: api({
      tag: "Wishlist",
      summary: "Customer thêm sản phẩm yêu thích",
      secured: true,
      success: 201,
      body: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["productId"],
              properties: {
                productId: {
                  type: "string",
                  pattern: "^[0-9a-fA-F]{24}$",
                  description: "ID của sản phẩm cần yêu thích",
                },
              },
            },
          },
        },
      },
    }),
  },

  "/api/wishlist/{productId}": {
    delete: api({
      tag: "Wishlist",
      summary: "Customer xóa sản phẩm yêu thích",
      secured: true,
      params: [idParam("productId")],
    }),
  },

  // ================= CART =================

  "/api/cart": {
    /*
     * GET /api/cart
     * Lấy giỏ hàng của CUSTOMER đang đăng nhập.
     * Trả về danh sách items với itemSubtotal từng dòng,
     * totalQuantity và totalAmount toàn giỏ.
     * Nếu chưa có item nào, trả về cấu trúc rỗng.
     */
    get: api({
      tag: "Cart",
      summary: "Customer xem giỏ hàng",
      secured: true,
      description:
        "Lấy giỏ hàng hiện tại của Customer. " +
        "Backend tự tính itemSubtotal, totalQuantity, totalAmount.",
    }),

    /*
     * DELETE /api/cart
     * Xóa toàn bộ items trong giỏ hàng.
     * Không xóa Cart document, chỉ làm rỗng mảng items.
     * Idempotent: gọi nhiều lần vẫn trả về thành công.
     */
    delete: api({
      tag: "Cart",
      summary: "Customer xóa toàn bộ giỏ hàng",
      secured: true,
      description:
        "Làm rỗng giỏ hàng. Không xóa Cart document. " +
        "Idempotent: gọi khi giỏ đã rỗng vẫn trả 200.",
    }),
  },

  "/api/cart/items": {
    /*
     * POST /api/cart/items
     * Thêm sản phẩm vào giỏ hàng.
     * Nếu Variant đã có trong giỏ, tăng quantity.
     * Giá lấy từ Backend (variant.price), không nhận từ Frontend.
     * Kiểm tra tồn kho trước khi thêm.
     */
    post: api({
      tag: "Cart",
      summary: "Customer thêm sản phẩm vào giỏ hàng",
      secured: true,
      success: 201,
      description:
        "Thêm Variant vào giỏ hàng. " +
        "Nếu Variant đã tồn tại, tăng quantity thay vì tạo item mới. " +
        "Giá luôn lấy từ Backend. " +
        "Không làm giảm Inventory.",
      body: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["variantId", "quantity"],
              properties: {
                variantId: {
                  type: "string",
                  pattern: "^[0-9a-fA-F]{24}$",
                  description: "ID của ProductVariant cần thêm vào giỏ",
                  example: "507f1f77bcf86cd799439011",
                },
                quantity: {
                  type: "integer",
                  minimum: 1,
                  description: "Số lượng cần thêm, phải là số nguyên dương",
                  example: 2,
                },
              },
            },
          },
        },
      },
    }),
  },

  "/api/cart/items/{itemId}": {
    /*
     * PATCH /api/cart/items/:itemId
     * Cập nhật số lượng một CartItem.
     * itemId là _id của CartItem (subdocument) trong mảng items.
     * Kiểm tra tồn kho với quantity mới trước khi cập nhật.
     */
    patch: api({
      tag: "Cart",
      summary: "Customer cập nhật số lượng CartItem",
      secured: true,
      params: [idParam("itemId")],
      description:
        "Cập nhật quantity của một item trong giỏ hàng. " +
        "itemId là _id của CartItem lấy từ GET /api/cart. " +
        "Kiểm tra tồn kho với quantity mới.",
      body: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["quantity"],
              properties: {
                quantity: {
                  type: "integer",
                  minimum: 1,
                  description: "Số lượng mới, phải là số nguyên dương",
                  example: 3,
                },
              },
            },
          },
        },
      },
    }),

    /*
     * DELETE /api/cart/items/:itemId
     * Xóa một CartItem khỏi giỏ hàng.
     * itemId là _id của CartItem (subdocument).
     * Không ảnh hưởng Inventory.
     */
    delete: api({
      tag: "Cart",
      summary: "Customer xóa một CartItem",
      secured: true,
      params: [idParam("itemId")],
      description:
        "Xóa một item khỏi giỏ hàng theo itemId. " +
        "itemId là _id của CartItem lấy từ GET /api/cart. " +
        "Không ảnh hưởng Inventory.",
    }),
  },
};
// Bước 9: Tạo tài liệu OpenAPI từ cấu hình.
const swaggerSpec = swaggerJsdoc({
  definition,
  apis: [],
});

// Bước 10: Export cấu hình.
module.exports = {
  swaggerUi,
  swaggerSpec,
};
