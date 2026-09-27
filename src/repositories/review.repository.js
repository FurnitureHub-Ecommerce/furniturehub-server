const mongoose = require("mongoose");
const Review = require("../models/Review.model");
const Product = require("../models/Product.model");

const findActiveProduct = (productId) => Product.exists({ _id: productId, isActive: true });
const findActiveByUserAndProduct = (user, product) => Review.findOne({ user, product, isActive: true });
const findActiveById = (id) => Review.findOne({ _id: id, isActive: true });
const create = (data) => Review.create(data);

// Điều kiện ghi luôn giữ ownership và trạng thái active, kể cả khi có request đồng thời.
const updateOwnedActive = (id, user, data) => Review.findOneAndUpdate(
  { _id: id, user, isActive: true },
  { $set: data },
  { returnDocument: "after", runValidators: true }
);

/**
 * Tính thống kê trên toàn bộ review active trước khi phân trang.
 * Dùng cùng một aggregation để danh sách và thống kê chia sẻ bộ lọc.
 * Chỉ trả ID người đánh giá, không populate email/password của User.
 */
const listByProduct = async (productId, page, limit) => {
  const [result] = await Review.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId), isActive: true } },
    { $sort: { createdAt: -1, _id: -1 } },
    { $facet: {
      reviews: [{ $skip: (page - 1) * limit }, { $limit: limit }, { $project: { __v: 0 } }],
      stats: [{ $group: { _id: null, averageRating: { $avg: "$rating" }, totalReviews: { $sum: 1 } } }],
    } },
  ]);
  return {
    reviews: result.reviews,
    averageRating: result.stats[0]?.averageRating ?? 0,
    totalReviews: result.stats[0]?.totalReviews ?? 0,
  };
};

module.exports = { findActiveProduct, findActiveByUserAndProduct, findActiveById, create, updateOwnedActive, listByProduct };
