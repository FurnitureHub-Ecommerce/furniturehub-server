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
 * Bước 8a: Khai báo kiểm tra checkout và các phản hồi cụ thể.
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
      CreateOrderInput: {
        type: "object", required: ["addressId"], additionalProperties: false,
        properties: {
          addressId: { type: "string", pattern: "^[0-9a-fA-F]{24}$", example: "507f1f77bcf86cd799439011" },
        },
      },
      OrderShippingAddress: {
        type: "object", required: ["receiverName", "phone", "addressLine", "ward", "city"],
        description: "Snapshot lúc đặt hàng, giữ nguyên khi Address bị sửa hoặc xóa",
        properties: {
          receiverName: { type: "string", example: "Nguyễn Văn A" },
          phone: { type: "string", example: "0912345678" },
          addressLine: { type: "string", example: "123 Lê Lợi" },
          ward: { type: "string", example: "Bến Thành" },
          city: { type: "string", example: "Hồ Chí Minh" },
        },
      },
      OrderItem: {
        type: "object", required: ["_id", "variantId", "quantity", "unitPrice", "itemSubtotal"],
        description: "Subdocument nhúng trong Order.items; Order cha xác định quyền sở hữu item. Không có collection OrderItem riêng.",
        properties: {
          _id: { type: "string" },
          variantId: { type: "string", description: "ID gốc, vẫn giữ khi Variant bị xóa" },
          productName: { type: "string", description: "Tên sản phẩm tại thời điểm đặt hàng" },
          sku: { type: "string" }, color: { type: "string" }, size: { type: "string" }, material: { type: "string" },
          quantity: { type: "integer", minimum: 1 },
          unitPrice: { type: "number", minimum: 0, description: "Giá cố định tại thời điểm đặt hàng" },
          itemSubtotal: { type: "number", minimum: 0, description: "Thành tiền đã lưu, không tính từ giá Variant hiện tại" },
        },
      },
      Order: {
        type: "object", required: ["_id", "userId", "status", "shippingAddress", "items", "subtotal", "totalAmount", "createdAt", "updatedAt"],
        properties: {
          _id: { type: "string" }, userId: { type: "string" },
          status: { type: "string", enum: ["pending"] },
          shippingAddress: { $ref: "#/components/schemas/OrderShippingAddress" },
          items: { type: "array", minItems: 1, items: { $ref: "#/components/schemas/OrderItem" } },
          subtotal: { type: "number", minimum: 0 },
          totalAmount: { type: "number", minimum: 0, description: "Bằng subtotal; không phí, thuế, giảm giá" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      OrderCreated: {
        type: "object", required: ["message", "order"],
        properties: {
          message: { type: "string", example: "Order created successfully" },
          order: { $ref: "#/components/schemas/Order" },
        },
      },
      OrderDetail: {
        type: "object", required: ["order"],
        properties: { order: { $ref: "#/components/schemas/Order" } },
      },
      CheckoutInput: {
        type: "object",
        required: ["addressId"],
        additionalProperties: false,
        properties: {
          addressId: {
            type: "string",
            pattern: "^[0-9a-fA-F]{24}$",
            description: "Địa chỉ giao hàng thuộc Customer đang đăng nhập",
            example: "507f1f77bcf86cd799439011",
          },
        },
      },
      CheckoutResult: {
        type: "object",
        required: ["message", "valid", "items", "totalAmount"],
        properties: {
          message: { type: "string", example: "Cart is valid for checkout" },
          valid: { type: "boolean", enum: [true] },
          items: { type: "array", items: { $ref: "#/components/schemas/CheckoutStockPriceItem" } },
          totalAmount: {
            type: "number", minimum: 0,
            description: "Tổng các itemSubtotal theo giá hiện tại; cũng là subtotal, không phí vận chuyển, thuế hay giảm giá",
          },
        },
      },
      CheckoutStockPriceItem: {
        type: "object",
        required: ["itemId", "variantId", "quantity", "requestedQuantity", "availableStock", "unitPrice", "itemSubtotal", "stockValid", "valid"],
        properties: {
          itemId: { type: "string", nullable: true },
          variantId: { type: "string", nullable: true },
          quantity: {
            nullable: true,
            description: "Số lượng lưu trong Cart; giữ giá trị sai kiểu để chẩn đoán khi valid=false",
          },
          requestedQuantity: { type: "integer", nullable: true, description: "Tổng quantity hợp lệ của mọi dòng cùng Variant; null nếu thiếu Variant hoặc vượt giới hạn" },
          availableStock: { type: "integer", nullable: true, minimum: 0, description: "Inventory.quantity; null nếu bản ghi thiếu hoặc sai dữ liệu" },
          unitPrice: { type: "number", nullable: true, minimum: 0, description: "ProductVariant.price hiện tại; null nếu giá không hợp lệ" },
          itemSubtotal: { type: "number", nullable: true, minimum: 0, description: "unitPrice nhân quantity; khi dòng lỗi chỉ có giá trị chẩn đoán" },
          stockValid: { type: "boolean", description: "Kết quả so sánh tồn kho; không thay thế valid của dòng hoặc toàn giỏ" },
          valid: { type: "boolean" },
        },
      },
      CheckoutError: {
        type: "object",
        required: ["message"],
        properties: {
          message: { type: "string" },
          valid: {
            type: "boolean",
            enum: [false],
            description: "Chỉ có khi kiểm tra nghiệp vụ giỏ hàng thất bại",
          },
          items: { type: "array", items: { $ref: "#/components/schemas/CheckoutStockPriceItem" } },
          totalAmount: { type: "number", nullable: true, description: "Luôn null nếu Cart có lỗi; không trả tổng một phần như tổng đã xác nhận" },
          errors: {
            type: "array",
            description:
              "Lỗi body giữ nguyên cấu trúc Zod issues. Lỗi CartItem có itemId, " +
              "variantId, code và message; một item có thể có nhiều lỗi.",
            items: {
              oneOf: [
                {
                  type: "object",
                  required: ["itemId", "variantId", "code", "message"],
                  properties: {
                    itemId: { type: "string", nullable: true },
                    variantId: {
                      type: "string",
                      nullable: true,
                      description: "null khi không populate được Variant; dùng itemId để xác định dòng lỗi",
                    },
                    code: {
                      type: "string",
                      enum: ["INVALID_QUANTITY", "VARIANT_NOT_FOUND", "VARIANT_INACTIVE", "PRODUCT_NOT_FOUND", "PRODUCT_INACTIVE", "INVENTORY_NOT_FOUND", "INVALID_STOCK", "INSUFFICIENT_STOCK", "INVALID_QUANTITY_TOTAL", "INVALID_PRICE", "INVALID_ITEM_TOTAL"],
                    },
                    message: { type: "string" },
                  },
                },
                {
                  type: "object",
                  required: ["code", "message"],
                  properties: {
                    code: { type: "string", enum: ["INVALID_TOTAL"] },
                    message: { type: "string" },
                  },
                },
                {
                  type: "object",
                  required: ["code", "path", "message"],
                  properties: {
                    code: { type: "string" },
                    message: { type: "string" },
                    path: {
                      type: "array",
                      items: { oneOf: [{ type: "string" }, { type: "integer" }] },
                    },
                  },
                },
              ],
            },
          },
        },
      },
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

      // Schema dùng cho POST và PUT Address (dữ liệu đầu vào).
      AddressInput: {
        type: "object",
        required: [
          "receiverName",
          "phone",
          "addressLine",
          "ward",
          "city",
        ],
        properties: {
          receiverName: {
            type: "string",
            example: "Nguyen Van A",
            description: "Tên người nhận hàng",
          },
          phone: {
            type: "string",
            example: "0912345678",
            description:
              "Số điện thoại Việt Nam (bắt đầu bằng 0 hoặc +84)",
          },
          addressLine: {
            type: "string",
            example: "123 Đường Lê Lợi",
            description: "Số nhà, tên đường",
          },
          ward: {
            type: "string",
            example: "Phường Bến Nghé",
            description: "Phường/xã",
          },
          city: {
            type: "string",
            example: "Hồ Chí Minh",
            description: "Tỉnh/thành phố",
          },
        },
      },
    },
  },

  tags: [
    { name: "Address", description: "Quản lý địa chỉ giao hàng" },
    { name: "Auth", description: "Xác thực người dùng" },
    { name: "Cart", description: "Quản lý giỏ hàng" },
    { name: "Checkout", description: "Kiểm tra điều kiện checkout" },
    { name: "Order", description: "Tạo và xem chi tiết đơn hàng" },
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
/**
 * Mục đích: mô tả response JSON của Checkout và Order, dùng các schema ở trên.
 * Đầu vào: mô tả mã HTTP, tên schema và các ví dụ theo từng trường hợp lỗi.
 * Bước 1: Gắn kiểu nội dung JSON và tham chiếu schema.
 * Bước 2: Gắn ví dụ để Swagger UI hiển thị được response mong đợi.
 * Bước 3: Trả cấu hình; không sửa helper api hoặc tài liệu endpoint trước đó.
 */
const checkoutResponse = (description, schemaName, examples) => ({
  description,
  content: {
    "application/json": {
      schema: { $ref: `#/components/schemas/${schemaName}` },
      examples,
    },
  },
});

definition.paths = {
  // Order chỉ dành cho Customer và lưu toàn bộ snapshot trong một document.
  "/api/orders": {
    post: {
      tags: ["Order"],
      summary: "Customer tạo đơn từ Cart hiện tại",
      description:
        "Body chỉ nhận addressId; userId lấy từ JWT. Địa chỉ phải thuộc Customer, không cần mặc định. " +
        "Đọc lại Cart, Product/Variant, giá và tồn kho từ database qua Task 2/3. " +
        "Gộp quantity các dòng cùng Variant để kiểm tra Inventory.quantity. " +
        "Có bất kỳ dòng lỗi nào đều từ chối toàn bộ đơn, trả 400 giống Checkout (kể cả thiếu hàng). " +
        "Order có status pending, shippingAddress là snapshot năm trường địa chỉ. " +
        "Mỗi CartItem trở thành một OrderItem với unitPrice và itemSubtotal đã tính theo giá hiện tại. " +
        "subtotal và totalAmount bằng tổng itemSubtotal, không thêm phí/thuế/giảm giá. " +
        "Order và toàn bộ items được nhúng và lưu bằng một insert atomic trên standalone lẫn Atlas; " +
        "chờ xác nhận ghi majority mới trả 201, không cần transaction nhiều document. " +
        "Không xử lý Payment, không trừ hoặc giữ Inventory, không xóa Cart. " +
        "Chưa có chống request trùng: gọi hai lần có thể tạo hai đơn; kiểm tra tồn kho không ngăn overselling. " +
        "Mất kết nối khi xác nhận ghi có thể trả 500 dù một đơn đầy đủ đã được lưu; không tự retry ở Service.",
      security: [{ bearerAuth: [] }],
      requestBody: requestBody("CreateOrderInput"),
      responses: {
        201: checkoutResponse("Đã lưu Order và đầy đủ items", "OrderCreated"),
        400: checkoutResponse("Body/Cart/Product/Variant/quantity/giá/tồn kho không hợp lệ; giữ cấu trúc lỗi Checkout", "CheckoutError"),
        401: checkoutResponse("Thiếu JWT hoặc JWT không hợp lệ/hết hạn", "CheckoutError"),
        403: checkoutResponse("Role không phải CUSTOMER", "CheckoutError"),
        404: checkoutResponse("Địa chỉ không tồn tại hoặc không thuộc Customer", "CheckoutError"),
        500: checkoutResponse("Lỗi hệ thống; không trả stack hay dữ liệu nội bộ", "CheckoutError", {
          serverError: { value: { message: "Internal server error" } },
        }),
      },
    },
  },
  "/api/orders/{id}": {
    get: {
      tags: ["Order"],
      summary: "Customer xem chi tiết đơn của mình",
      description:
        "Query cả _id và userId từ JWT. Đơn không tồn tại hoặc của người khác đều trả 404. " +
        "Trả shippingAddress, items, unitPrice, itemSubtotal, subtotal, totalAmount đã lưu và timestamps. " +
        "Không populate Address/ProductVariant/User, không tính lại tiền. " +
        "Địa chỉ, giá và thông tin sản phẩm lịch sử vẫn còn khi nguồn bị sửa hoặc xóa.",
      security: [{ bearerAuth: [] }],
      parameters: [idParam()],
      responses: {
        200: checkoutResponse("Chi tiết đầy đủ từ snapshot của Order", "OrderDetail"),
        400: checkoutResponse("Order ID sai định dạng", "CheckoutError", {
          invalidId: { value: { message: "Invalid order ID" } },
        }),
        401: checkoutResponse("Thiếu JWT hoặc JWT không hợp lệ/hết hạn", "CheckoutError"),
        403: checkoutResponse("Role không phải CUSTOMER", "CheckoutError"),
        404: checkoutResponse("Đơn không tồn tại hoặc không thuộc Customer", "CheckoutError", {
          missingOrder: { value: { message: "Order not found" } },
        }),
        500: checkoutResponse("Lỗi hệ thống, không trả chi tiết nội bộ", "CheckoutError", {
          serverError: { value: { message: "Internal server error" } },
        }),
      },
    },
  },
  // Kiểm tra checkout chỉ đọc dữ liệu của Customer đang đăng nhập.
  "/api/checkout/validate": {
    post: {
      tags: ["Checkout"],
      summary: "Customer kiểm tra địa chỉ, giỏ hàng, tồn kho và giá hiện tại",
      description:
        "Chỉ CUSTOMER được gọi. Body chỉ nhận addressId, userId lấy từ JWT. " +
        "Kiểm tra quyền sở hữu địa chỉ, Cart không rỗng, quantity là số nguyên >= 1, " +
        "Variant và Product tồn tại, có isActive=true. Lỗi Cart trả 400; " +
        "địa chỉ không tồn tại hoặc thuộc người khác cùng trả 404. " +
        "Gộp quantity các dòng trùng Variant rồi so với Inventory.quantity của một kho. " +
        "Giá lấy từ ProductVariant.price, không dùng hay cập nhật snapshot CartItem.unitPrice. " +
        "totalAmount là tổng itemSubtotal, không thêm phí vận chuyển, thuế, coupon hoặc giảm giá. " +
        "Giữ giá thập phân theo schema; nhân/cộng chính xác, từ chối kết quả không biểu diễn an toàn bằng Number. " +
        "Cart API vẫn giữ hợp đồng snapshot và làm tròn VND như trước. " +
        "Thiếu Inventory, thiếu hàng, giá hoặc số lượng lỗi đều trả 400, valid=false; " +
        "items chỉ là chẩn đoán và totalAmount=null. Không có Cart/giỏ rỗng không trả items hay tổng. " +
        "Chỉ đọc dữ liệu, không tạo hay sửa Cart/Address/Inventory, không tạo Order hay Payment. " +
        "Kết quả chỉ phản ánh thời điểm gọi API, không giữ hàng hoặc bảo đảm giá/tồn kho. " +
        "Phải kiểm tra lại điều kiện quan trọng tại thời điểm tạo đơn.",
      security: [{ bearerAuth: [] }],
      requestBody: requestBody("CheckoutInput"),
      responses: {
        200: checkoutResponse("Cart đủ điều kiện tiếp tục checkout", "CheckoutResult", {
          valid: { value: {
            message: "Cart is valid for checkout", valid: true,
            items: [{ itemId: "507f1f77bcf86cd799439012", variantId: "507f1f77bcf86cd799439013", quantity: 2, requestedQuantity: 2, availableStock: 10, unitPrice: 1200000, itemSubtotal: 2400000, stockValid: true, valid: true }],
            totalAmount: 2400000,
          } },
        }),
        400: checkoutResponse("Body hoặc giỏ hàng không hợp lệ", "CheckoutError", {
          invalidAddressId: {
            value: {
              message: "Validation failed",
              errors: [{ code: "invalid_format", path: ["addressId"], message: "Invalid address ID", format: "regex", pattern: "/^[a-fA-F0-9]{24}$/" }],
            },
          },
          forbiddenField: {
            value: {
              message: "Validation failed",
              errors: [{ code: "unrecognized_keys", keys: ["userId"], path: [], message: 'Unrecognized key: "userId"' }],
            },
          },
          missingCart: { value: { message: "Cart not found", valid: false } },
          emptyCart: { value: { message: "Cart is empty", valid: false } },
          invalidItem: {
            value: {
              message: "Cart is invalid for checkout",
              valid: false,
              items: [{ itemId: "507f1f77bcf86cd799439012", variantId: null, quantity: 2, requestedQuantity: null, availableStock: null, unitPrice: null, itemSubtotal: null, stockValid: false, valid: false }],
              totalAmount: null,
              errors: [{ itemId: "507f1f77bcf86cd799439012", variantId: null, code: "VARIANT_NOT_FOUND", message: "Product variant not found" }],
            },
          },
          insufficientStock: { value: {
            message: "Cart is invalid for checkout", valid: false,
            items: [{ itemId: "507f1f77bcf86cd799439012", variantId: "507f1f77bcf86cd799439013", quantity: 5, requestedQuantity: 5, availableStock: 3, unitPrice: 1200000, itemSubtotal: 6000000, stockValid: false, valid: false }],
            totalAmount: null,
            errors: [{ itemId: "507f1f77bcf86cd799439012", variantId: "507f1f77bcf86cd799439013", code: "INSUFFICIENT_STOCK", message: "Insufficient stock. Available: 3, Requested total: 5" }],
          } },
        }),
        401: checkoutResponse("Thiếu JWT hoặc JWT không hợp lệ/hết hạn", "CheckoutError", {
          missingToken: { value: { message: "Access token is required" } },
          invalidToken: { value: { message: "Invalid or expired token" } },
        }),
        403: checkoutResponse("Role không phải CUSTOMER", "CheckoutError", {
          forbidden: { value: { message: "Forbidden: insufficient permission" } },
        }),
        404: checkoutResponse("Địa chỉ không tồn tại hoặc không thuộc Customer", "CheckoutError", {
          addressNotFound: { value: { message: "Không tìm thấy địa chỉ" } },
        }),
        500: checkoutResponse("Lỗi hệ thống, không trả chi tiết nội bộ", "CheckoutError", {
          serverError: { value: { message: "Internal server error" } },
        }),
      },
    },
  },
  // ================= ADDRESS =================

  /**
   * Mục đích:
   * Khai báo tài liệu API quản lý địa chỉ giao hàng.
   *
   * Tất cả 6 endpoint đều yêu cầu JWT Bearer Token với role CUSTOMER.
   * userId luôn lấy từ JWT, không từ request body.
   *
   * GET    /api/addresses           - Lấy danh sách địa chỉ.
   * POST   /api/addresses           - Tạo địa chỉ mới.
   * GET    /api/addresses/:id       - Lấy chi tiết địa chỉ.
   * PUT    /api/addresses/:id       - Cập nhật toàn phần địa chỉ.
   * PATCH  /api/addresses/:id/default - Đặt địa chỉ làm mặc định.
   * DELETE /api/addresses/:id       - Xóa địa chỉ.
   */
  "/api/addresses": {
    /*
     * GET /api/addresses
     * Lấy tất cả địa chỉ của Customer đang đăng nhập.
     * Địa chỉ mặc định hiển thị đầu tiên.
     * Trả mảng rỗng nếu chưa có địa chỉ nào.
     */
    get: api({
      tag: "Address",
      summary: "Customer xem danh sách địa chỉ",
      secured: true,
      description:
        "Lấy tất cả địa chỉ giao hàng của Customer đang đăng nhập. " +
        "Địa chỉ mặc định (isDefault=true) hiển thị đầu tiên. " +
        "Trả mảng rỗng nếu chưa có địa chỉ.",
    }),

    /*
     * POST /api/addresses
     * Tạo địa chỉ mới.
     * Địa chỉ đầu tiên tự động là mặc định (isDefault=true).
     * Client không được gửi userId hoặc isDefault.
     */
    post: api({
      tag: "Address",
      summary: "Customer tạo địa chỉ mới",
      secured: true,
      success: 201,
      description:
        "Tạo địa chỉ giao hàng mới cho Customer. " +
        "Địa chỉ đầu tiên tự động trở thành mặc định. " +
        "userId lấy từ JWT. isDefault do Backend quyết định. " +
        "Không được gửi userId, isDefault, _id trong body.",
      body: requestBody("AddressInput"),
    }),
  },

  "/api/addresses/{id}": {
    /*
     * GET /api/addresses/:id
     * Xem chi tiết một địa chỉ.
     * Trả 404 nếu không tồn tại hoặc không thuộc Customer.
     */
    get: api({
      tag: "Address",
      summary: "Customer xem chi tiết địa chỉ",
      secured: true,
      params: [idParam()],
      description:
        "Lấy chi tiết một địa chỉ theo ID. " +
        "Trả 400 nếu ID không hợp lệ. " +
        "Trả 404 nếu không tìm thấy hoặc không phải địa chỉ của Customer.",
    }),

    /*
     * PUT /api/addresses/:id
     * Cập nhật toàn phần thông tin địa chỉ.
     * Phải gửi đủ tất cả các trường.
     * isDefault KHÔNG thay đổi qua endpoint này.
     */
    put: api({
      tag: "Address",
      summary: "Customer cập nhật địa chỉ",
      secured: true,
      params: [idParam()],
      description:
        "Cập nhật toàn phần thông tin địa chỉ (full update). " +
        "Phải gửi đủ receiverName, phone, addressLine, ward, city. " +
        "isDefault không thay đổi qua endpoint này. " +
        "Không được gửi userId, isDefault trong body (trả 400).",
      body: requestBody("AddressInput"),
    }),

    /*
     * DELETE /api/addresses/:id
     * Xóa địa chỉ.
     * Xóa địa chỉ mặc định → tự động chuyển sang địa chỉ cũ nhất còn lại.
     * Xóa địa chỉ cuối cùng → không còn địa chỉ mặc định.
     */
    delete: api({
      tag: "Address",
      summary: "Customer xóa địa chỉ",
      secured: true,
      params: [idParam()],
      description:
        "Xóa một địa chỉ. " +
        "Nếu xóa địa chỉ mặc định và còn địa chỉ khác, " +
        "tự động chọn địa chỉ cũ nhất làm mặc định mới. " +
        "Xóa địa chỉ cuối cùng không gây lỗi.",
    }),
  },

  "/api/addresses/{id}/default": {
    /*
     * PATCH /api/addresses/:id/default
     * Đặt địa chỉ làm mặc định.
     * Địa chỉ mặc định cũ sẽ bị bỏ mặc định.
     * Không cần request body.
     */
    patch: api({
      tag: "Address",
      summary: "Customer đặt địa chỉ làm mặc định",
      secured: true,
      params: [idParam()],
      description:
        "Đặt một địa chỉ làm mặc định. " +
        "Địa chỉ mặc định cũ sẽ tự động bị bỏ mặc định. " +
        "Không cần request body. " +
        "Nếu địa chỉ đã là mặc định, trả 200 không thay đổi gì.",
    }),
  },

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
