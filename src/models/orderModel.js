/**
 * @Author: Minh Truong
 *
 * Mục đích: lưu toàn bộ giao dịch lịch sử trong một document Order.
 * OrderItem nhúng trong items theo cách Cart hiện tại lưu CartItem;
 * Order chứa item chính là liên kết sở hữu, không cần collection/orderId trùng lặp.
 * Mỗi item có _id riêng và variantId, nhưng giá/thông tin hiển thị là snapshot.
 * Địa chỉ nhúng đủ năm trường, không phụ thuộc vòng đời của Address.
 * Một lần insert lưu cả Order và mọi item, atomic trên standalone lẫn Atlas.
 * Validate mọi subdocument trước khi ghi; không chấp nhận items rỗng hoặc null.
 * Không có Payment, giữ hàng hay thao tác cập nhật Cart trong model này.
 */
const mongoose = require("mongoose");
const { ORDER_STATUSES } = require("../constants/orderStatus");

const shippingAddressSchema = new mongoose.Schema({
  receiverName: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  addressLine: { type: String, required: true, trim: true },
  ward: { type: String, required: true, trim: true },
  city: { type: String, required: true, trim: true },
}, { _id: false });

const orderItemSchema = new mongoose.Schema({
  variantId: { type: mongoose.Schema.Types.ObjectId, ref: "ProductVariant", required: true },
  productName: { type: String },
  sku: { type: String },
  color: { type: String },
  size: { type: String },
  material: { type: String },
  quantity: { type: Number, required: true, min: 1, validate: Number.isSafeInteger },
  unitPrice: { type: Number, required: true, min: 0, max: Number.MAX_SAFE_INTEGER, validate: Number.isFinite },
  itemSubtotal: { type: Number, required: true, min: 0, max: Number.MAX_SAFE_INTEGER, validate: Number.isFinite },
});

const orderSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
  shippingAddress: { type: shippingAddressSchema, required: true, immutable: true },
  items: {
    type: [orderItemSchema],
    required: true,
    immutable: true,
    validate: {
      validator: (items) => Array.isArray(items) && items.length > 0 && items.every((item) => item != null),
      message: "Order must contain all ordered items",
    },
  },
  // Enum chỉ kiểm tra giá trị lưu; quy tắc chuyển và nghiệp vụ do Order Service kiểm tra.
  // Đơn mới vẫn là pending; thêm cancelled để chuẩn bị quy tắc hủy của Task 3.
  status: { type: String, enum: ORDER_STATUSES, default: "pending", required: true },
  subtotal: { type: Number, required: true, min: 0, max: Number.MAX_SAFE_INTEGER, validate: Number.isFinite, immutable: true },
  totalAmount: { type: Number, required: true, min: 0, max: Number.MAX_SAFE_INTEGER, validate: Number.isFinite, immutable: true },
}, { timestamps: true });

module.exports = mongoose.model("Order", orderSchema);
