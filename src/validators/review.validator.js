const { z } = require("zod");

const reviewIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid ObjectId");
const reviewFields = {
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().optional(),
};

// Từ chối trường lạ để client không giả mạo chủ sở hữu hay trạng thái review.
const createReviewSchema = z.object({
  productId: reviewIdSchema,
  ...reviewFields,
}).strict();
const updateReviewSchema = z.object(reviewFields).partial().strict().refine(
  (data) => Object.keys(data).length > 0,
  "At least one field is required"
);

// Giữ page=1, limit=10, tối đa 100 giống danh sách Product/Order.
const reviewQuerySchema = z.object({
  page: z.string().pipe(z.coerce.number().int().min(1)).default(1),
  limit: z.string().pipe(z.coerce.number().int().min(1).max(100)).default(10),
}).strict().refine(
  ({ page, limit }) => Number.isSafeInteger((page - 1) * limit),
  { message: "Pagination offset exceeds the safe integer limit", path: ["page"] }
);

const validateReviewId = (parameter) => (req, res, next) => {
  if (!reviewIdSchema.safeParse(req.params[parameter]).success) {
    return res.status(400).json({ message: `Invalid ${parameter === "productId" ? "product" : "review"} ID` });
  }
  return next();
};

module.exports = { createReviewSchema, updateReviewSchema, reviewQuerySchema, reviewIdSchema, validateReviewId };
