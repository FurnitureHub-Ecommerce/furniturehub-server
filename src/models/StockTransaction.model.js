/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Lưu vết lịch sử biến động tồn kho (StockTransaction) cho từng ProductVariant
 * phục vụ nhập/xuất/kiểm kê kho và các nghiệp vụ đơn hàng hiện có.
 *
 * Thiết kế:
 * - inventoryId: liên kết tới document Inventory tương ứng.
 * - variantId: liên kết tới ProductVariant có biến động kho; SKU được đọc từ variant.
 * - orderId: chỉ bắt buộc cho DEDUCTION/RESTORE của đơn hàng.
 * - type: IMPORT, EXPORT, ADJUSTMENT; giữ DEDUCTION/RESTORE cho đơn hàng.
 * - quantity: độ lớn thay đổi; ADJUSTMENT có thể bằng 0 khi kiểm kê không đổi.
 * - beforeQuantity: số lượng tồn kho trước khi thực hiện giao dịch.
 * - afterQuantity: số lượng tồn kho sau khi thực hiện giao dịch.
 * - createdBy: userId của nhân viên (hoặc khách hàng) thực hiện thao tác.
 *
 * Ràng buộc & Toàn vẹn:
 * - Unique compound index trên { orderId, variantId, type } ngăn chặn triệt để
 *   việc trừ kho hai lần hoặc hoàn kho hai lần cho cùng một variant trong một đơn hàng.
 * - Bản ghi này được lưu cùng transaction với Inventory; giao dịch đơn hàng còn bao gồm Order.
 */

const mongoose = require("mongoose");

const {
  MANUAL_STOCK_TYPES,
  ORDER_STOCK_TYPES,
  STOCK_TRANSACTION_TYPES,
} = require("../constants/stockTransactionTypes");

const stockTransactionSchema = new mongoose.Schema(
  {
    inventoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Inventory",
      required: true,
      immutable: true,
    },

    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
      immutable: true,
    },

    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: function () { return ORDER_STOCK_TYPES.includes(this.type); },
      immutable: true,
    },

    type: {
      type: String,
      enum: STOCK_TRANSACTION_TYPES,
      required: true,
      immutable: true,
    },

    quantity: {
      type: Number,
      required: true,
      min: 0,
      validate: function (value) {
        return Number.isSafeInteger(value) && (this.type === "ADJUSTMENT" || value > 0);
      },
      immutable: true,
    },

    beforeQuantity: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger,
      immutable: true,
    },

    afterQuantity: {
      type: Number,
      required: true,
      min: 0,
      validate: Number.isSafeInteger,
      immutable: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      required: function () { return MANUAL_STOCK_TYPES.includes(this.type); },
      immutable: true,
    },

    note: {
      type: String,
      trim: true,
      maxlength: 500,
      immutable: true,
    },
  },
  {
    timestamps: true,
  }
);

// Unique index ngăn chặn trừ hoặc hoàn kho hai lần cho cùng một biến thể trong một đơn hàng
stockTransactionSchema.index(
  { orderId: 1, variantId: 1, type: 1 },
  {
    name: "unique_order_variant_type",
    unique: true,
    partialFilterExpression: { orderId: { $type: "objectId" } },
  }
);

stockTransactionSchema.index({ variantId: 1, createdAt: -1, _id: -1 });
stockTransactionSchema.index({ createdAt: -1, _id: -1 });
stockTransactionSchema.index({ inventoryId: 1 });

stockTransactionSchema.statics.TYPES = STOCK_TRANSACTION_TYPES;

module.exports = mongoose.model("StockTransaction", stockTransactionSchema);
