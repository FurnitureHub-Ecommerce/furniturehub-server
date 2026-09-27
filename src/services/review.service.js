const reviewRepository = require("../repositories/review.repository");
const { reviewIdSchema, reviewQuerySchema } = require("../validators/review.validator");

const makeError = (message, statusCode) => Object.assign(new Error(message), { statusCode });

const requireUserId = (userId) => {
  if (!reviewIdSchema.safeParse(userId).success) throw makeError("Invalid user ID in token", 401);
};

const requireProduct = async (productId) => {
  if (!await reviewRepository.findActiveProduct(productId)) throw makeError("Product not found", 404);
};

/**
 * Lấy chủ sở hữu từ JWT, kiểm tra Product active rồi kiểm tra review trùng trước khi tạo.
 * Order hiện chỉ có pending/confirmed/rejected/cancelled; confirmed vẫn có thể hủy.
 * Chưa có trạng thái hoàn thành nên chưa áp dụng xác minh mua hàng, không suy diễn từ Payment.
 * Unique index chỉ áp dụng review active và bảo vệ cả trường hợp tạo đồng thời.
 */
const create = async (userId, data) => {
  requireUserId(userId);
  await requireProduct(data.productId);
  if (await reviewRepository.findActiveByUserAndProduct(userId, data.productId)) {
    throw makeError("You already have an active review for this product", 409);
  }
  return reviewRepository.create({ user: userId, product: data.productId, rating: data.rating, comment: data.comment });
};

const getByProduct = async (productId, query) => {
  const parsed = reviewQuerySchema.safeParse(query);
  if (!parsed.success) {
    const error = makeError("Validation failed", 400);
    error.errors = parsed.error.issues;
    throw error;
  }
  await requireProduct(productId);
  const { page, limit } = parsed.data;
  const result = await reviewRepository.listByProduct(productId, page, limit);
  return {
    ...result,
    pagination: { page, limit, totalItems: result.totalReviews, totalPages: Math.ceil(result.totalReviews / limit) },
  };
};

// Phân biệt review không tồn tại (404) với review active của người khác (403).
const requireOwnedReview = async (userId, id) => {
  requireUserId(userId);
  const review = await reviewRepository.findActiveById(id);
  if (!review) throw makeError("Review not found", 404);
  if (!review.user.equals(userId)) throw makeError("You can only modify your own review", 403);
};

const update = async (userId, id, data) => {
  await requireOwnedReview(userId, id);
  // Whitelist ngay tại Service; không chuyển body trực tiếp vào lệnh cập nhật MongoDB.
  const changes = {};
  if (data.rating !== undefined) changes.rating = data.rating;
  if (data.comment !== undefined) changes.comment = data.comment;
  const review = await reviewRepository.updateOwnedActive(id, userId, changes);
  if (!review) throw makeError("Review not found", 404);
  return review;
};

const remove = async (userId, id) => {
  await requireOwnedReview(userId, id);
  const review = await reviewRepository.updateOwnedActive(id, userId, { isActive: false });
  if (!review) throw makeError("Review not found", 404);
};

module.exports = { create, getByProduct, update, remove };
