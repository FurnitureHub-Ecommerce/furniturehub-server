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
 * Bước 8b: Mô tả nền tảng cập nhật trạng thái đơn và nghiệp vụ còn phụ thuộc.
 * Bước 9: Tạo Swagger Specification.
 * Bước 10: Export cấu hình để app.js sử dụng.
 *
 * Lưu ý:
 * Swagger chỉ mô tả API, không thay đổi logic Backend.
 */

const swaggerJsdoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const { ORDER_STATUSES } = require("../constants/orderStatus");
const { STOCK_TRANSACTION_TYPES } = require("../constants/stockTransactionTypes");

// Schema và tham số dùng chung cho Inventory.
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const quantity = { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER };
const id = { type: "string", pattern: "^[0-9a-fA-F]{24}$" };
const note = {
  type: "string", maxLength: 500,
  description: "Ghi chú tùy chọn; bỏ khoảng trắng đầu/cuối rồi giới hạn 500 ký tự.",
  example: "Nhập hàng đợt tháng 9",
};
const variantParam = { name: "variantId", in: "path", required: true, schema: id };
const pageParams = [
  { name: "page", in: "query", schema: { type: "integer", minimum: 1, maximum: 1000000, default: 1 } },
  { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 20 } },
];
const listParams = [
  ...pageParams,
  { name: "variantId", in: "query", schema: id },
  { name: "sku", in: "query", description: "SKU chính xác, tự trim và chuyển chữ hoa", schema: { type: "string", minLength: 1, maxLength: 200 } },
];

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
      InventoryVariant: {
        type: "object", nullable: true,
        properties: {
          _id: id,
          sku: { type: "string", example: "SOFA-MILANO-BEIGE-L" },
          color: { type: "string" }, size: { type: "string" }, material: { type: "string" },
          isActive: { type: "boolean" },
          productId: {
            type: "object", nullable: true,
            properties: { _id: id, name: { type: "string" }, isActive: { type: "boolean" } },
          },
        },
      },
      Inventory: {
        type: "object", required: ["_id", "variantId", "quantity", "lowStockThreshold"],
        description: "Một kho; mỗi variantId có tối đa một Inventory. SKU lấy từ ProductVariant, không lưu lại trong Inventory. GET populate variantId, thao tác ghi trả variantId dạng ID.",
        properties: {
          _id: id,
          variantId: { oneOf: [id, ref("InventoryVariant")] },
          quantity,
          lowStockThreshold: { ...quantity, default: 3 },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      InventoryPagination: {
        type: "object", required: ["page", "limit", "totalItems", "totalPages"],
        properties: {
          page: { type: "integer" }, limit: { type: "integer" },
          totalItems: { type: "integer" }, totalPages: { type: "integer" },
        },
      },
      InventoryList: {
        type: "object", required: ["inventories", "pagination"],
        properties: {
          inventories: { type: "array", items: ref("Inventory") },
          pagination: ref("InventoryPagination"),
        },
      },
      InventoryDetail: {
        type: "object", required: ["inventory"], properties: { inventory: ref("Inventory") },
      },
      StockMovementInput: {
        type: "object", required: ["quantity"], additionalProperties: false,
        properties: { quantity: { ...quantity, minimum: 1, example: 10 }, note },
      },
      StockAdjustmentInput: {
        type: "object", required: ["quantity"], additionalProperties: false,
        description: "quantity là số lượng thực tế mới, không phải phần cộng/trừ.",
        properties: { quantity: { ...quantity, example: 9 }, note },
      },
      StockThresholdInput: {
        type: "object", required: ["lowStockThreshold"], additionalProperties: false,
        properties: { lowStockThreshold: { ...quantity, example: 3 } },
      },
      StockChangeResult: {
        type: "object", required: ["message", "inventory", "transaction"],
        properties: {
          message: { type: "string" }, inventory: ref("Inventory"), transaction: ref("StockTransaction"),
        },
      },
      StockThresholdResult: {
        type: "object", required: ["message", "inventory"],
        properties: { message: { type: "string" }, inventory: ref("Inventory") },
      },
      StockTransactionList: {
        type: "object", required: ["transactions", "pagination"],
        properties: {
          transactions: { type: "array", items: ref("StockTransaction") },
          pagination: ref("InventoryPagination"),
        },
      },
      InventoryError: {
        type: "object", required: ["message"],
        properties: {
          message: { type: "string" },
          errors: { type: "array", description: "Zod validation issues nếu có", items: { type: "object" } },
        },
      },
      CreateOrderInput: {
        type: "object", required: ["addressId"], additionalProperties: false,
        properties: {
          addressId: { type: "string", pattern: "^[0-9a-fA-F]{24}$", example: "507f1f77bcf86cd799439011" },
        },
      },
      // Dùng cùng enum với Model và Validator để tài liệu không lệch quy tắc.
      UpdateOrderStatusInput: {
        type: "object", required: ["status"], additionalProperties: false,
        description:
          "Chỉ nhận status. Enum hợp lệ chưa đồng nghĩa được phép chuyển trạng thái; " +
          "Service còn kiểm tra trạng thái hiện tại và nghiệp vụ tương ứng.",
        properties: {
          status: { type: "string", enum: ORDER_STATUSES, example: "confirmed" },
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
          status: {
            type: "string", enum: ORDER_STATUSES, default: "pending",
            description: "Đơn mới pending; confirmed trừ kho, rejected/cancelled hoàn kho nếu đơn đã confirmed.",
          },
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
      OrderStatusUpdated: {
        type: "object", required: ["message", "order"],
        description: "Kết quả PATCH /status: thông tin trạng thái tối giản sau khi nghiệp vụ kho hoàn tất.",
        properties: {
          message: { type: "string", example: "Order status updated successfully" },
          order: {
            type: "object", required: ["_id", "status", "updatedAt"],
            properties: {
              _id: { type: "string" },
              status: { type: "string", enum: ["confirmed", "rejected", "cancelled"] },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
        },
      },
      // Schema response cho Confirm, Reject và Cancel Order (Task 2 & Task 3).
      OrderConfirmRejectResult: {
        type: "object",
        required: ["message", "data"],
        description: "Phản hồi thành công khi xác nhận, từ chối hoặc hủy đơn hàng. data chứa snapshot tối giản sau khi cập nhật.",
        properties: {
          message: { type: "string", example: "Order confirmed successfully" },
          data: {
            type: "object",
            required: ["_id", "status"],
            properties: {
              _id: { type: "string", example: "507f1f77bcf86cd799439011" },
              status: { type: "string", enum: ["confirmed", "rejected", "cancelled"], example: "confirmed" },
              updatedAt: { type: "string", format: "date-time" },
            },
          },
        },
      },
      // Lịch sử dùng chung cho nhập/xuất/kiểm kê thủ công và trừ/hoàn theo đơn hàng.
      StockTransaction: {
        type: "object",
        required: ["_id", "inventoryId", "variantId", "type", "quantity", "beforeQuantity", "afterQuantity", "createdAt"],
        description: "Lịch sử kho thủ công và đơn hàng. quantity là độ lớn thay đổi; ADJUSTMENT có thể bằng 0. orderId chỉ có với DEDUCTION/RESTORE.",
        properties: {
          _id: { type: "string", example: "6650a1b2c3d4e5f607a8b901" },
          inventoryId: { type: "string", example: "6650a1b2c3d4e5f607a8b902" },
          variantId: { oneOf: [{ type: "string" }, { $ref: "#/components/schemas/InventoryVariant" }] },
          orderId: { type: "string", example: "6650a1b2c3d4e5f607a8b904" },
          type: { type: "string", enum: STOCK_TRANSACTION_TYPES, example: "IMPORT" },
          quantity: { type: "integer", minimum: 0, example: 2 },
          beforeQuantity: { type: "integer", minimum: 0, example: 20 },
          afterQuantity: { type: "integer", minimum: 0, example: 22 },
          createdBy: { description: "Người thao tác lấy từ JWT; bắt buộc với IMPORT/EXPORT/ADJUSTMENT, không nhận từ body.", oneOf: [
            { type: "string", nullable: true },
            { type: "object", properties: { _id: { type: "string" }, fullName: { type: "string" } } },
          ] },
          note: { type: "string", maxLength: 500 },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },

      // ===== PAYMENT SCHEMAS (Task 5) =====
      CreatePaymentInput: {
        type: "object",
        required: ["paymentMethod"],
        additionalProperties: false,
        description:
          "Body chỉ nhận paymentMethod. Backend tự lấy amount từ Order.totalAmount, không nhận từ Frontend. " +
          "MOMO không nằm trong danh sách vì chưa tích hợp thực tế.",
        properties: {
          paymentMethod: {
            type: "string",
            enum: ["COD", "BANK_TRANSFER"],
            example: "COD",
            description: "COD: thanh toán khi nhận hàng. BANK_TRANSFER: chuyển khoản, xác nhận thủ công bởi nhân viên.",
          },
        },
      },
      Payment: {
        type: "object",
        required: ["_id", "orderId", "amount", "paymentMethod", "status", "createdAt", "updatedAt"],
        description:
          "Payment record liên kết 1-1 với Order. amount lấy từ Order.totalAmount, không tính lại. " +
          "status ban đầu luôn là pending. Chỉ STAFF/ADMIN có thể chuyển sang paid hoặc cancelled.",
        properties: {
          _id: { type: "string", example: "6650a1b2c3d4e5f607a8b9c0" },
          orderId: { type: "string", example: "6650a1b2c3d4e5f607a8b900" },
          amount: { type: "number", minimum: 0, example: 5000000, description: "Sao chép từ Order.totalAmount; không thể thay đổi." },
          paymentMethod: { type: "string", enum: ["COD", "BANK_TRANSFER"], example: "COD" },
          status: {
            type: "string", enum: ["pending", "paid", "failed", "cancelled"], example: "pending",
            description: "pending: chờ xác nhận. paid: đã xác nhận bởi STAFF/ADMIN. failed: thất bại. cancelled: đã hủy.",
          },
          paidAt: { type: "string", format: "date-time", nullable: true, example: null, description: "Thời điểm xác nhận; null khi chưa paid." },
          confirmedBy: { type: "string", nullable: true, example: null, description: "userId của STAFF/ADMIN xác nhận; null khi chưa xác nhận." },
          note: { type: "string", nullable: true, example: null, description: "Ghi chú từ nhân viên khi xác nhận." },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      PaymentCreated: {
        type: "object", required: ["message", "payment"],
        properties: {
          message: { type: "string", example: "Payment created successfully" },
          payment: { $ref: "#/components/schemas/Payment" },
        },
      },
      PaymentDetail: {
        type: "object", required: ["payment"],
        properties: { payment: { $ref: "#/components/schemas/Payment" } },
      },
      UpdatePaymentStatusInput: {
        type: "object",
        required: ["status"],
        additionalProperties: false,
        description: "Chỉ STAFF/ADMIN được gọi. Customer không thể tự đánh dấu paid. Chỉ Payment pending mới được cập nhật.",
        properties: {
          status: {
            type: "string", enum: ["paid", "cancelled"], example: "paid",
            description: "paid: xác nhận đã nhận tiền. cancelled: hủy Payment theo quy trình.",
          },
          note: { type: "string", maxLength: 500, example: "GD123456 - Nguyen Van A - 21/09/2026", description: "Ghi chú tùy chọn." },
        },
      },
      PaymentStatusUpdated: {
        type: "object", required: ["message", "payment"],
        properties: {
          message: { type: "string", example: "Payment status updated successfully" },
          payment: { $ref: "#/components/schemas/Payment" },
        },
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
          availableStock: {
            type: "integer",
            minimum: 0,
            nullable: true,
            readOnly: true,
            example: 12,
            description: "GET danh sách/chi tiết: tổng tồn kho các biến thể đang hoạt động. Không có biến thể: 0; tồn kho thiếu hoặc không hợp lệ: null.",
          },
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
          availableStock: {
            type: "integer",
            minimum: 0,
            nullable: true,
            readOnly: true,
            example: 5,
            description: "GET danh sách/chi tiết: Inventory.quantity của biến thể; 0 là hết hàng, null là tồn kho chưa xác định.",
          },
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
    { name: "Order", description: "Tạo, xem chi tiết và kiểm soát trạng thái đơn hàng" },
    { name: "Payment", description: "Quản lý thanh toán đơn hàng" },
    { name: "Category", description: "Quản lý danh mục" },
    { name: "Brand", description: "Quản lý thương hiệu" },
    { name: "Product", description: "Quản lý sản phẩm" },
    { name: "Variant", description: "Quản lý biến thể và SKU" },
    { name: "Wishlist", description: "Quản lý danh sách yêu thích" },
    { name: "Inventory", description: "Quản lý tồn kho một cửa hàng — STORAGE_MANAGER thao tác, ADMIN chỉ xem" },
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
 * API quản lý dữ liệu yêu cầu Bearer Token với role tương ứng.
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

// Khai báo response và nghiệp vụ quản lý kho trong cùng tài liệu Swagger.
const response = (description, schema, examples) => ({
  description, content: { "application/json": { schema: ref(schema), ...(examples && { examples }) } },
});
const operation = (summary, description, resultSchema, parameters = [], bodySchema = null, storageManagerOnly = false) => ({
  tags: ["Inventory"],
  summary,
  description: (storageManagerOnly
    ? "Chỉ STORAGE_MANAGER được thao tác. ADMIN chỉ có quyền xem kho và bị từ chối với 403. "
    : "STORAGE_MANAGER và ADMIN được xem. ") + description,
  security: [{ bearerAuth: [] }],
  parameters,
  ...(bodySchema && { requestBody: { required: true, content: { "application/json": { schema: ref(bodySchema) } } } }),
  responses: {
    200: response("Thành công", resultSchema),
    400: response("ID/query/body không hợp lệ hoặc xuất vượt tồn kho", "InventoryError"),
    401: response("Thiếu JWT hoặc JWT không hợp lệ", "InventoryError"),
    403: response(storageManagerOnly
      ? "Chỉ STORAGE_MANAGER được thao tác; ADMIN, CUSTOMER và STAFF bị từ chối"
      : "Không đủ quyền; CUSTOMER và STAFF bị từ chối", "InventoryError"),
    404: response("Variant hoặc Inventory không tồn tại", "InventoryError"),
    409: response("Xung đột tồn kho hoặc index; kiểm tra và thử lại", "InventoryError"),
    500: response("Lỗi hệ thống", "InventoryError"),
  },
});
// Ví dụ trước/sau và lỗi đi cùng từng thao tác để người dùng thử đúng nghiệp vụ trên Swagger.
const mutation = (summary, description, schema, example) => {
  const { type, beforeQuantity, afterQuantity, input, message } = example;
  const minimum = type === "ADJUSTMENT" ? 0 : 1;
  const result = operation(summary,
    description + " Inventory và StockTransaction commit cùng một MongoDB transaction; cần replica set hoặc Atlas. " +
    "createdBy lấy từ JWT, không nhận userId/type/beforeQuantity/afterQuantity/orderId từ body. " +
    "SKU lấy từ ProductVariant; không lưu trùng trong Inventory. Note là chuỗi tùy chọn, trim và tối đa 500 ký tự. " +
    "StockTransaction.quantity là độ lớn thay đổi; ADJUSTMENT không đổi tồn kho ghi quantity=0. " +
    "Mỗi yêu cầu thành công là một thao tác mới và tạo một bản ghi lịch sử.",
    "StockChangeResult", [variantParam], schema, true);
  result.requestBody.content["application/json"].example = input;
  const inventoryId = "507f1f77bcf86cd799439011";
  const variantId = "507f1f77bcf86cd799439012";
  const createdAt = "2026-09-24T03:00:00.000Z";
  result.responses[200] = response("Thành công; tồn kho và một bản ghi lịch sử đã được lưu", "StockChangeResult", {
    success: { value: {
      message,
      inventory: {
        _id: inventoryId, variantId, quantity: afterQuantity, lowStockThreshold: 3,
        createdAt, updatedAt: createdAt,
      },
      transaction: {
        _id: "507f1f77bcf86cd799439013", inventoryId, variantId, type,
        quantity: Math.abs(afterQuantity - beforeQuantity), beforeQuantity, afterQuantity,
        createdBy: "507f1f77bcf86cd799439014", note: input.note, createdAt, updatedAt: createdAt,
      },
    } },
  });
  result.responses[400] = response("ID/body/số lượng không hợp lệ hoặc số lượng kết quả vượt giới hạn an toàn" +
    (type === "EXPORT" ? "; xuất vượt tồn kho cũng trả 400" : ""), "InventoryError", {
    invalidId: { value: { message: "Invalid variant ID" } },
    invalidBody: { value: { message: "Invalid JSON body" } },
    invalidQuantity: { summary: type === "ADJUSTMENT" ? "quantity âm" : "quantity bằng 0 hoặc âm", value: {
      message: "Validation failed",
      errors: [{ origin: "number", code: "too_small", minimum, inclusive: true,
        path: ["quantity"], message: `Too small: expected number to be >=${minimum}` }],
    } },
    ...(type === "EXPORT" && {
      insufficientStock: { value: { message: "Insufficient stock. Available: 10, Requested: 11" } },
    }),
  });
  result.responses[401] = response("Thiếu JWT, JWT không hợp lệ/hết hạn hoặc thiếu/sai userId trong JWT", "InventoryError", {
    noToken: { value: { message: "Access token is required" } },
    invalidToken: { value: { message: "Invalid or expired token" } },
    invalidActor: { value: { message: "Unauthorized" } },
  });
  result.responses[404] = response(type === "EXPORT"
    ? "ProductVariant hoặc Inventory không tồn tại"
    : "ProductVariant không tồn tại; nếu variant tồn tại nhưng chưa có Inventory thì khởi tạo từ 0",
  "InventoryError", {
    missingVariant: { value: { message: "Product variant not found" } },
    ...(type === "EXPORT" && { missingInventory: { value: { message: "Inventory not found" } } }),
  });
  result.responses[500] = response("Lỗi hệ thống; lỗi trước commit hủy cả thay đổi tồn kho và lịch sử", "InventoryError", {
    serverError: { value: { message: "Internal server error" } },
  });
  result.responses[503] = response("MongoDB standalone không hỗ trợ transaction; không thay đổi tồn kho hoặc lịch sử", "InventoryError", {
    transactionsRequired: { value: { message: "Stock changes require MongoDB replica set or Atlas transactions" } },
  });
  return result;
};

// Phản hồi lỗi dùng chung cho bốn API đổi trạng thái có trừ/hoàn kho.
const orderStockErrors = {
  400: checkoutResponse("ID/body/số lượng không hợp lệ hoặc không đủ tồn kho; không thay đổi dữ liệu", "CheckoutError", {
    invalidId: { value: { message: "Invalid order ID" } },
    insufficientStock: { value: { message: "Insufficient stock for variant 507f1f77bcf86cd799439013. Available: 3, Requested: 5" } },
  }),
  401: checkoutResponse("Thiếu JWT, JWT không hợp lệ/hết hạn hoặc thiếu định danh người dùng", "CheckoutError"),
  403: checkoutResponse("Không đủ quyền thực hiện thao tác hoặc Customer không sở hữu đơn cần hủy", "CheckoutError"),
  404: checkoutResponse("Order, ProductVariant hoặc Inventory cần trừ/hoàn kho không tồn tại", "CheckoutError", {
    missingOrder: { value: { message: "Order not found" } },
    missingVariant: { value: { message: "Product variant not found: 507f1f77bcf86cd799439013" } },
    missingInventory: { value: { message: "Inventory not found for variant(s): 507f1f77bcf86cd799439013" } },
  }),
  409: checkoutResponse("Trạng thái lặp/trái quy tắc, lịch sử kho không khớp, dữ liệu tồn kho lỗi, thanh toán đã hoàn tất hoặc xung đột ghi", "CheckoutError", {
    repeated: { value: { message: 'Order already has status "confirmed"' } },
    historyMismatch: { value: { message: "Stock deduction history does not match order items" } },
    paidOrder: { value: { message: "Cannot reject or cancel order: payment has already been completed. Refund workflow is not implemented." } },
    concurrentUpdate: { value: { message: "Order status has already been changed by another request" } },
  }),
  500: checkoutResponse("Lỗi hệ thống; lỗi trước commit rollback transaction, không lộ thông tin nội bộ", "CheckoutError", {
    serverError: { value: { message: "Internal server error" } },
  }),
  503: checkoutResponse("MongoDB standalone không hỗ trợ transaction: không đổi trạng thái, số lượng hoặc lịch sử", "CheckoutError", {
    transactionsRequired: { value: { message: "Order status changes require MongoDB replica set or Atlas transactions" } },
  }),
};

definition.paths = {
  "/api/inventory": {
    get: operation("Xem tồn kho, SKU và thuộc tính biến thể",
      "Trả các Inventory đã khởi tạo, gồm cả variant/product đã vô hiệu hóa. Phân trang, mới nhất trước. " +
      "Variant chưa có Inventory được khởi tạo khi nhập hàng hoặc điều chỉnh lần đầu.", "InventoryList", listParams),
  },
  "/api/inventory/low-stock": {
    get: operation("Xem sản phẩm sắp hết hàng",
      "Lọc quantity <= lowStockThreshold, bao gồm quantity=0. Dùng ngưỡng riêng của từng Inventory.",
      "InventoryList", listParams),
  },
  "/api/inventory/transactions": {
    // Tra cứu lịch sử không sửa kho; bộ lọc không khớp trả danh sách rỗng, không trả lỗi thiếu kho.
    get: {
      tags: ["Inventory"],
      summary: "Xem lịch sử biến động kho",
      description:
        "STORAGE_MANAGER và ADMIN được xem; CUSTOMER và STAFF bị từ chối với 403. " +
        "Trả { transactions, pagination }, sắp xếp createdAt giảm dần rồi _id giảm dần khi trùng thời gian. " +
        "variantId được populate SKU, thuộc tính biến thể và productId.name từ ProductVariant/Product; " +
        "SKU không được lưu trùng trong lịch sử. createdBy là trường người thao tác hiện có, " +
        "tương đương performedBy, chỉ populate _id và fullName; không trả mật khẩu hay email. " +
        "Nếu variant, product hoặc người thao tác đã bị xóa thì liên kết được populate thành null, lịch sử vẫn được trả. " +
        "Bao gồm IMPORT/EXPORT/ADJUSTMENT và DEDUCTION/RESTORE của đơn hàng; quantity là độ lớn thay đổi, " +
        "ADJUSTMENT có thể bằng 0. Các bộ lọc được kết hợp đồng thời. " +
        "from/to là thời gian ISO 8601 có múi giờ, bao gồm hai mốc; from không được lớn hơn to. " +
        "Không có bản ghi khớp (kể cả variantId hợp lệ nhưng không tồn tại) trả 200 với transactions=[] " +
        "và totalItems=totalPages=0. Trang vượt tổng số trang trả mảng rỗng, giữ tổng số bản ghi khớp. " +
        "Chỉ đọc dữ liệu, không thay đổi Inventory hay tạo StockTransaction; không yêu cầu MongoDB transaction.",
      security: [{ bearerAuth: [] }],
      parameters: [
        ...pageParams,
        { name: "variantId", in: "query", description: "Lọc chính xác ProductVariant ObjectId gồm 24 ký tự hex; không truyền SKU.", schema: id },
        { name: "type", in: "query", description: "Loại biến động, phân biệt chữ hoa/thường; dùng enum hiện có của StockTransaction.", schema: { type: "string", enum: STOCK_TRANSACTION_TYPES } },
        { name: "from", in: "query", description: "createdAt >= from; ISO 8601 có Z hoặc múi giờ như +07:00. Mã hóa dấu + thành %2B khi viết trực tiếp URL.", schema: { type: "string", format: "date-time", example: "2026-09-01T00:00:00.000Z" } },
        { name: "to", in: "query", description: "createdAt <= to; ISO 8601 có múi giờ, phải >= from khi truyền cả hai mốc.", schema: { type: "string", format: "date-time", example: "2026-09-30T23:59:59.999Z" } },
      ],
      responses: {
        200: response("Lịch sử kho theo bộ lọc và thông tin phân trang", "StockTransactionList", {
          populated: { summary: "Lịch sử nhập kho có SKU, sản phẩm và người thao tác", value: {
            transactions: [{
              _id: "507f1f77bcf86cd799439013",
              inventoryId: "507f1f77bcf86cd799439011",
              variantId: {
                _id: "507f1f77bcf86cd799439012", sku: "SOFA-MILANO-BEIGE-L",
                color: "Beige", size: "L", material: "Vải", isActive: true,
                productId: { _id: "507f1f77bcf86cd799439015", name: "Sofa Milano", isActive: true },
              },
              type: "IMPORT", quantity: 10, beforeQuantity: 20, afterQuantity: 30,
              createdBy: { _id: "507f1f77bcf86cd799439014", fullName: "Nguyễn Văn Kho" },
              note: "Nhập thêm hàng", createdAt: "2026-09-24T03:00:00.000Z", updatedAt: "2026-09-24T03:00:00.000Z",
            }],
            pagination: { page: 1, limit: 20, totalItems: 1, totalPages: 1 },
          } },
          empty: { summary: "Không có lịch sử khớp bộ lọc", value: {
            transactions: [], pagination: { page: 1, limit: 20, totalItems: 0, totalPages: 0 },
          } },
        }),
        400: response("variantId/type/ngày/phân trang không hợp lệ, from > to hoặc query chứa trường không hỗ trợ", "InventoryError", {
          invalidVariantId: { value: { message: "Validation failed", errors: [{
            origin: "string", code: "invalid_format", format: "regex", pattern: "/^[a-fA-F0-9]{24}$/",
            path: ["variantId"], message: "Invalid variant ID",
          }] } },
          invalidRange: { value: { message: "Validation failed", errors: [{
            code: "custom", path: ["to"], message: "from must not be later than to",
          }] } },
        }),
        401: response("Thiếu JWT hoặc JWT không hợp lệ/hết hạn", "InventoryError", {
          noToken: { value: { message: "Access token is required" } },
          invalidToken: { value: { message: "Invalid or expired token" } },
        }),
        403: response("Chỉ STORAGE_MANAGER và ADMIN được xem; CUSTOMER và STAFF bị từ chối", "InventoryError", {
          wrongRole: { value: { message: "Forbidden: insufficient permission" } },
        }),
        500: response("Lỗi hệ thống khi đọc lịch sử", "InventoryError", {
          serverError: { value: { message: "Internal server error" } },
        }),
      },
    },
  },
  "/api/inventory/{variantId}": {
    get: operation("Xem tồn kho một biến thể", "Trả 404 nếu Variant hoặc Inventory chưa tồn tại.", "InventoryDetail", [variantParam]),
  },
  "/api/inventory/{variantId}/import": {
    post: mutation("Nhập hàng", "Tăng tồn kho với quantity nguyên dương; tự khởi tạo Inventory nếu chưa có. Ghi IMPORT.", "StockMovementInput", {
      type: "IMPORT", beforeQuantity: 20, afterQuantity: 30,
      input: { quantity: 10, note: "Nhập thêm hàng" }, message: "Stock imported successfully",
    }),
  },
  "/api/inventory/{variantId}/export": {
    post: mutation("Xuất hàng", "Giảm tồn kho với quantity nguyên dương. Inventory phải tồn tại; thiếu hàng trả 400, không để tồn kho âm. Ghi EXPORT.", "StockMovementInput", {
      type: "EXPORT", beforeQuantity: 10, afterQuantity: 7,
      input: { quantity: 3, note: "Xuất kho" }, message: "Stock exported successfully",
    }),
  },
  "/api/inventory/{variantId}/adjust": {
    patch: mutation("Điều chỉnh sau kiểm kê", "Đặt tồn kho bằng quantity mới (nguyên, >=0). Tự khởi tạo Inventory nếu chưa có. Ghi ADJUSTMENT với số lượng trước/sau.", "StockAdjustmentInput", {
      type: "ADJUSTMENT", beforeQuantity: 20, afterQuantity: 15,
      input: { quantity: 15, note: "Kiểm kê kho thực tế" }, message: "Stock adjusted successfully",
    }),
  },
  "/api/inventory/{variantId}/threshold": {
    patch: operation("Cập nhật ngưỡng low-stock",
      "Chỉ cập nhật lowStockThreshold của Inventory đã tồn tại; không thay đổi quantity, không tạo stock transaction.",
      "StockThresholdResult", [variantParam], "StockThresholdInput", true),
  },
  // Tạo Order dành cho Customer và lưu toàn bộ snapshot trong một document.
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
  /**
   * Dùng các endpoint Order hiện có; backend tự trừ/hoàn kho theo trạng thái.
   * Mọi thay đổi Order/Inventory/StockTransaction cần replica set hoặc Atlas.
   */
  "/api/orders/{id}/status": {
    patch: {
      tags: ["Order"],
      summary: "STAFF/ADMIN cập nhật trạng thái Order và tự động xử lý kho",
      description:
        "Chỉ STAFF và ADMIN được gọi; CUSTOMER và STORAGE_MANAGER trả 403. " +
        "Body chỉ có status. Quy tắc: pending → confirmed/rejected/cancelled; confirmed → rejected/cancelled. " +
        "Cùng trạng thái, chuyển về pending hoặc chuyển tiếp từ rejected/cancelled trả 409. " +
        "confirmed gọi confirmOrder để kiểm tra tất cả variant/tồn kho, trừ kho và ghi DEDUCTION. " +
        "rejected/cancelled dùng chung nghiệp vụ đóng đơn: chỉ hoàn kho nếu nguồn là confirmed và lịch sử trừ khớp toàn bộ items. " +
        "Không đủ hàng trả 400; thiếu Variant/Inventory trả 404. " +
        "Trạng thái đơn, toàn bộ tồn kho và lịch sử commit cùng một transaction. " +
        "Cần MongoDB replica set/Atlas; standalone trả 503, không có cơ chế ghi riêng lẻ thay thế.",
      security: [{ bearerAuth: [] }],
      parameters: [idParam()],
      requestBody: requestBody("UpdateOrderStatusInput"),
      responses: {
        ...orderStockErrors,
        200: checkoutResponse("Đổi trạng thái và xử lý kho thành công", "OrderStatusUpdated", {
          confirmed: { value: {
            message: "Order status updated successfully",
            order: { _id: "507f1f77bcf86cd799439011", status: "confirmed", updatedAt: "2026-09-24T03:00:00.000Z" },
          } },
        }),
      },
    },
  },
  "/api/orders/{id}/confirm": {
    patch: {
      tags: ["Order"],
      summary: "STAFF/ADMIN xác nhận đơn pending và trừ kho một lần",
      description:
        "Chỉ STAFF và ADMIN được gọi. Không cần body. Chỉ pending → confirmed được phép. " +
        "OrderItem tham chiếu ProductVariant; gộp quantity các dòng cùng variant trước khi kiểm tra. " +
        "Kiểm tra toàn bộ ProductVariant, Inventory và số lượng an toàn trước khi ghi bất kỳ dòng nào. " +
        "Thiếu hàng trả 400; thiếu Variant/Inventory trả 404 và giữ nguyên toàn bộ đơn/kho/lịch sử. " +
        "Trừ kho bằng cập nhật có điều kiện số lượng đã đọc và $gte, ngăn tồn kho âm. " +
        "Ghi DEDUCTION với orderId, inventoryId, variantId, quantity, beforeQuantity, afterQuantity, createdBy từ JWT và note. " +
        "Kiểm tra trạng thái/lịch sử và unique index orderId+variantId+type chống trừ hai lần. " +
        "Order, Inventory và StockTransaction commit cùng transaction; lỗi trước commit rollback mọi thay đổi. " +
        "Gọi lại hoặc confirm đồng thời cùng đơn: chỉ một lần trừ kho, yêu cầu còn lại trả 409. " +
        "Cần replica set/Atlas; standalone trả 503 trước khi thay đổi dữ liệu.",
      security: [{ bearerAuth: [] }],
      parameters: [idParam()],
      responses: {
        ...orderStockErrors,
        200: checkoutResponse("Đã xác nhận và trừ kho", "OrderConfirmRejectResult", {
          confirmed: { value: {
            message: "Order confirmed successfully",
            data: { _id: "507f1f77bcf86cd799439011", status: "confirmed", updatedAt: "2026-09-24T03:00:00.000Z" },
          } },
        }),
      },
    },
  },
  "/api/orders/{id}/reject": {
    patch: {
      tags: ["Order"],
      summary: "STAFF/ADMIN từ chối đơn pending/confirmed; hoàn kho nếu đã trừ",
      description:
        "Chỉ STAFF và ADMIN được gọi; không cần body. pending → rejected không cộng kho vì chưa từng trừ. " +
        "confirmed → rejected hoàn đúng quantity theo lịch sử DEDUCTION, sau khi đối chiếu đầy đủ với Order.items. " +
        "Lịch sử thiếu/không khớp hoặc đã có RESTORE trả 409. Thiếu Variant/Inventory khi hoàn kho trả 404; không ghi RESTORE giả. " +
        "Ghi RESTORE với before/after, orderId, variantId, inventoryId, createdBy từ JWT và note. " +
        "Trạng thái, tồn kho, lịch sử nằm trong cùng transaction; cùng trạng thái/đơn đã cancelled trả 409, không hoàn lần hai. " +
        "Giữ chính sách thanh toán hiện có: Payment paid chặn thao tác với 409; Payment pending chuyển cancelled khi đóng đơn. " +
        "Cần replica set/Atlas; standalone trả 503. PATCH /status với status=rejected dùng cùng nghiệp vụ.",
      security: [{ bearerAuth: [] }],
      parameters: [idParam()],
      responses: {
        ...orderStockErrors,
        200: checkoutResponse("Đã từ chối đơn và hoàn kho nếu đã confirmed", "OrderConfirmRejectResult", {
          rejected: { value: {
            message: "Order rejected successfully",
            data: { _id: "507f1f77bcf86cd799439011", status: "rejected", updatedAt: "2026-09-24T03:00:00.000Z" },
          } },
        }),
      },
    },
  },
  "/api/orders/{id}/cancel": {
    patch: {
      tags: ["Order"],
      summary: "Customer hủy đơn của mình / STAFF, ADMIN hủy đơn pending hoặc confirmed",
      description:
        "CUSTOMER chỉ được hủy đơn của mình; STAFF/ADMIN được hủy đơn hợp lệ. STORAGE_MANAGER trả 403. " +
        "Không cần body. pending → cancelled không cộng kho; confirmed → cancelled hoàn theo DEDUCTION đã lưu. " +
        "Lịch sử phải đầy đủ, khớp Order.items và chưa có RESTORE. Thiếu Variant/Inventory trả 404 và giữ nguyên đơn/kho/lịch sử. " +
        "RESTORE lưu số trước/sau và createdBy từ JWT. Gọi lại hoặc reject/cancel đồng thời chỉ hoàn một lần. " +
        "Nếu Payment paid, trả 409 do chưa có quy trình hoàn tiền; Payment pending được đồng bộ cancelled trong cùng transaction. " +
        "Order, Inventory và StockTransaction commit cùng transaction trên replica set/Atlas. " +
        "Standalone trả 503, không có thao tác cộng/trừ bù ngoài transaction. " +
        "PATCH /status với status=cancelled dùng cùng nghiệp vụ, vẫn chỉ cho STAFF/ADMIN.",
      security: [{ bearerAuth: [] }],
      parameters: [idParam()],
      responses: {
        ...orderStockErrors,
        200: checkoutResponse("Đã hủy đơn và hoàn kho nếu đã confirmed", "OrderConfirmRejectResult", {
          cancelled: { value: {
            message: "Order cancelled successfully",
            data: { _id: "507f1f77bcf86cd799439011", status: "cancelled", updatedAt: "2026-09-24T03:00:00.000Z" },
          } },
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

  // ===== PAYMENT API PATHS (Task 5) =====
  "/api/orders/{orderId}/payment": {
    post: {
      tags: ["Payment"],
      summary: "Customer tạo Payment cho Order của mình",
      description:
        "Chỉ CUSTOMER được gọi. orderId lấy từ URL; userId lấy từ JWT. " +
        "Body chỉ gửi paymentMethod; Backend tự lấy amount từ Order.totalAmount, không nhận từ Frontend. " +
        "Order phải tồn tại, thuộc Customer hiện tại, có totalAmount > 0 và đang ở trạng thái cho phép (pending). " +
        "COD và BANK_TRANSFER đều tạo Payment với status='pending'; không bao giờ tự động đánh dấu 'paid'. " +
        "Nếu Payment pending cùng method đã tồn tại (idempotent), trả Payment hiện tại. " +
        "Nếu Payment đã paid hoặc có phương thức khác, trả 409. " +
        "MOMO chưa tích hợp, không xuất hiện trong danh sách hợp lệ. " +
        "Unique index trên orderId ở Model ngăn tạo hai Payment đồng thời.",
      security: [{ bearerAuth: [] }],
      parameters: [idParam("orderId")],
      requestBody: requestBody("CreatePaymentInput"),
      responses: {
        201: checkoutResponse("Đã tạo Payment với status pending", "PaymentCreated"),
        400: checkoutResponse("orderId sai định dạng hoặc amount không hợp lệ", "CheckoutError", {
          invalidId: { value: { message: "Invalid order ID" } },
          validationFailed: { value: { message: "Validation failed", errors: [{ message: "Payment method must be one of: COD, BANK_TRANSFER" }] } },
        }),
        401: checkoutResponse("Thiếu JWT hoặc JWT không hợp lệ/hết hạn", "CheckoutError"),
        403: checkoutResponse("Role không phải CUSTOMER", "CheckoutError"),
        404: checkoutResponse("Order không tồn tại hoặc không thuộc Customer", "CheckoutError", {
          notFound: { value: { message: "Order not found" } },
        }),
        409: checkoutResponse("Payment đã tồn tại hoặc Order không ở trạng thái hợp lệ", "CheckoutError", {
          alreadyPaid: { value: { message: "Payment already exists for this order with status \"paid\"" } },
        }),
        500: checkoutResponse("Lỗi hệ thống", "CheckoutError", { serverError: { value: { message: "Internal server error" } } }),
      },
    },
    get: {
      tags: ["Payment"],
      summary: "Customer xem Payment của Order mình",
      description:
        "Chỉ CUSTOMER được gọi. Kiểm tra quyền sở hữu Order trước khi trả Payment. " +
        "Order không tồn tại hoặc thuộc người khác đều trả 404. " +
        "Payment chưa được tạo cũng trả 404. " +
        "Payment Status độc lập với Order Status.",
      security: [{ bearerAuth: [] }],
      parameters: [idParam("orderId")],
      responses: {
        200: checkoutResponse("Thông tin Payment của Order", "PaymentDetail"),
        400: checkoutResponse("orderId sai định dạng", "CheckoutError", {
          invalidId: { value: { message: "Invalid order ID" } },
        }),
        401: checkoutResponse("Thiếu JWT hoặc JWT không hợp lệ/hết hạn", "CheckoutError"),
        403: checkoutResponse("Role không phải CUSTOMER", "CheckoutError"),
        404: checkoutResponse("Order không thuộc Customer hoặc Payment chưa tạo", "CheckoutError", {
          orderNotFound: { value: { message: "Order not found" } },
          paymentNotFound: { value: { message: "Payment not found" } },
        }),
        500: checkoutResponse("Lỗi hệ thống", "CheckoutError", { serverError: { value: { message: "Internal server error" } } }),
      },
    },
  },
  "/api/payments/{paymentId}/status": {
    patch: {
      tags: ["Payment"],
      summary: "STAFF/ADMIN xác nhận hoặc hủy Payment",
      description:
        "Chỉ STAFF và ADMIN được gọi. Customer bị từ chối với 403. " +
        "Xác nhận thanh toán là thao tác thủ công sau khi nhân viên kiểm tra thực tế: " +
        "COD: đã thu tiền khi giao hàng. BANK_TRANSFER: đã đối soát giao dịch chuyển khoản. " +
        "Chỉ Payment đang 'pending' mới được cập nhật. " +
        "Payment đã 'paid' hoặc 'cancelled' không được thay đổi. " +
        "confirmedBy lưu userId của nhân viên xác nhận để truy vết. " +
        "paidAt được ghi khi status chuyển sang 'paid'. " +
        "findOneAndUpdate với điều kiện status='pending' ngăn race condition. " +
        "Không tự động cập nhật Order status hoặc Inventory khi xác nhận.",
      security: [{ bearerAuth: [] }],
      parameters: [idParam("paymentId")],
      requestBody: requestBody("UpdatePaymentStatusInput"),
      responses: {
        200: checkoutResponse("Payment đã được cập nhật thành công", "PaymentStatusUpdated"),
        400: checkoutResponse("paymentId sai định dạng hoặc body không hợp lệ", "CheckoutError", {
          invalidId: { value: { message: "Invalid payment ID" } },
          validationFailed: { value: { message: "Validation failed", errors: [{ message: "Status must be one of: paid, cancelled" }] } },
        }),
        401: checkoutResponse("Thiếu JWT hoặc JWT không hợp lệ/hết hạn", "CheckoutError"),
        403: checkoutResponse("Role không phải STAFF hoặc ADMIN (Customer bị từ chối tại đây)", "CheckoutError"),
        404: checkoutResponse("Payment không tồn tại", "CheckoutError", {
          notFound: { value: { message: "Payment not found" } },
        }),
        409: checkoutResponse("Payment không ở trạng thái pending hoặc race condition", "CheckoutError", {
          notPending: { value: { message: "Cannot update payment with status \"paid\". Only \"pending\" payments can be updated." } },
          raceCondition: { value: { message: "Payment status has already been updated by another request" } },
        }),
        500: checkoutResponse("Lỗi hệ thống", "CheckoutError", { serverError: { value: { message: "Internal server error" } } }),
      },
    },
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
