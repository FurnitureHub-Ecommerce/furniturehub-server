// Tài liệu Review được ghép vào Swagger chung; các module khác giữ nguyên tài liệu.
const id = { type: "string", pattern: "^[a-fA-F0-9]{24}$" };
const rating = { type: "integer", minimum: 1, maximum: 5, example: 5 };
const comment = { type: "string", description: "Tự trim khoảng trắng đầu/cuối.", example: "Sản phẩm tốt" };
const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const response = (description, schema) => ({ description, content: { "application/json": { schema } } });
const error = (description) => response(description, ref("ReviewError"));
const param = (name) => ({ name, in: "path", required: true, schema: id });
const request = (schema) => ({ required: true, content: { "application/json": { schema } } });
const security = [{ bearerAuth: [] }];
const commonErrors = {
  400: error("ObjectId, rating, body hoặc query không hợp lệ; trường lạ bị từ chối."),
  500: error("Lỗi hệ thống."),
};
const authErrors = {
  401: error("Thiếu JWT, JWT không hợp lệ/hết hạn hoặc userId trong JWT không hợp lệ."),
  403: error("Sai role; PATCH/DELETE cũng trả 403 nếu review active thuộc Customer khác."),
};

const schemas = {
  Review: {
    type: "object",
    required: ["_id", "user", "product", "rating", "isActive", "createdAt", "updatedAt"],
    properties: {
      _id: id, user: id, product: id, rating, comment,
      isActive: { type: "boolean", default: true },
      createdAt: { type: "string", format: "date-time" },
      updatedAt: { type: "string", format: "date-time" },
    },
  },
  ReviewCreateRequest: {
    type: "object", additionalProperties: false, required: ["productId", "rating"],
    properties: { productId: id, rating, comment },
  },
  ReviewUpdateRequest: {
    type: "object", additionalProperties: false, minProperties: 1,
    properties: { rating, comment },
  },
  ReviewResponse: {
    type: "object", required: ["message", "review"],
    properties: { message: { type: "string" }, review: ref("Review") },
  },
  ProductReviewsResponse: {
    type: "object", required: ["reviews", "averageRating", "totalReviews", "pagination"],
    properties: {
      reviews: { type: "array", items: ref("Review") },
      averageRating: { type: "number", minimum: 0, maximum: 5, description: "Trung bình tất cả review active của Product, không chỉ trang hiện tại; 0 nếu chưa có review." },
      totalReviews: { type: "integer", minimum: 0 },
      pagination: {
        type: "object", required: ["page", "limit", "totalItems", "totalPages"],
        properties: {
          page: { type: "integer", minimum: 1 }, limit: { type: "integer", minimum: 1, maximum: 100 },
          totalItems: { type: "integer", minimum: 0 }, totalPages: { type: "integer", minimum: 0 },
        },
      },
    },
  },
  ReviewError: {
    type: "object", required: ["message"],
    properties: {
      message: { type: "string" },
      errors: { type: "array", description: "Chi tiết lỗi Zod khi body/query không hợp lệ.", items: { type: "object", additionalProperties: true } },
    },
  },
};

const paths = {
  "/api/reviews": {
    post: {
      tags: ["Review"], summary: "CUSTOMER tạo đánh giá Product", security,
      description: "User lấy từ JWT. Chỉ Product active; mỗi Customer tối đa một review active cho Product. " +
        "Review đã xóa mềm không chặn tạo lại. Chưa áp dụng verified purchase: enum Order hiện chỉ có " +
        "pending/confirmed/rejected/cancelled, chưa có trạng thái hoàn thành; confirmed vẫn có thể hủy/từ chối. " +
        "Khách chưa mua cũng có thể review; API không khẳng định đã xác minh mua hàng.",
      requestBody: request(ref("ReviewCreateRequest")),
      responses: {
        201: response("Tạo review thành công.", ref("ReviewResponse")), ...commonErrors, ...authErrors,
        404: error("Product không tồn tại hoặc inactive."),
        409: error("Customer đã có review active cho Product, bao gồm request tạo đồng thời."),
      },
    },
  },
  "/api/reviews/product/{productId}": {
    get: {
      tags: ["Review"], summary: "Xem review active và thống kê của Product", security: [],
      description: "Public, không yêu cầu JWT. Chỉ nhận page/limit. Sắp xếp mới nhất trước theo createdAt rồi _id. " +
        "Không populate dữ liệu riêng tư của User và không ghi averageRating vào Product. Offset phân trang phải là số nguyên an toàn.",
      parameters: [
        param("productId"),
        { name: "page", in: "query", schema: { type: "integer", minimum: 1, default: 1 } },
        { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 10 } },
      ],
      responses: {
        200: response("Danh sách và thống kê review active.", ref("ProductReviewsResponse")), ...commonErrors,
        404: error("Product không tồn tại hoặc inactive."),
      },
    },
  },
  "/api/reviews/{id}": {
    patch: {
      tags: ["Review"], summary: "CUSTOMER sửa review của mình", security,
      description: "Chỉ cho sửa rating/comment và phải gửi ít nhất một trường. Cấm đổi user, product, createdAt, role, isActive hoặc ownership.",
      parameters: [param("id")], requestBody: request(ref("ReviewUpdateRequest")),
      responses: {
        200: response("Cập nhật review thành công.", ref("ReviewResponse")), ...commonErrors, ...authErrors,
        404: error("Review không tồn tại hoặc đã inactive."),
      },
    },
    delete: {
      tags: ["Review"], summary: "CUSTOMER xóa mềm review của mình", security,
      description: "Đặt isActive=false. ADMIN/STAFF/STORAGE_MANAGER không có quyền moderation trong API này.",
      parameters: [param("id")],
      responses: {
        200: response("Review đã inactive.", {
          type: "object", required: ["message"], properties: { message: { type: "string", example: "Review deactivated successfully" } },
        }),
        ...commonErrors, ...authErrors, 404: error("Review không tồn tại hoặc đã inactive."),
      },
    },
  },
};

module.exports = { schemas, paths };
