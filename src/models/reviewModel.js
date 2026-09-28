const mongoose = require("mongoose");

// Đánh giá thuộc Customer và Product; xóa mềm để giữ lịch sử.
const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, immutable: true },
  product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, immutable: true },
  rating: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
  comment: { type: String, trim: true },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Chặn cả hai request tạo đồng thời, nhưng cho phép đánh giá lại sau khi xóa mềm.
reviewSchema.index({ user: 1, product: 1 }, {
  unique: true,
  partialFilterExpression: { isActive: true },
});
reviewSchema.index({ product: 1, isActive: 1, createdAt: -1, _id: -1 });

module.exports = mongoose.model("Review", reviewSchema);
