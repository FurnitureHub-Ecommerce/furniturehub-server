const { z } = require("zod");
const { STOCK_TRANSACTION_TYPES } = require("../constants/stockTransactionTypes");

const variantIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, "Invalid variant ID");
const quantitySchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const noteSchema = z.string().trim().max(500).optional();

// Nhập/xuất là lượng biến động nên phải nguyên dương; không ép chuỗi thành số.
// Từ chối trường lạ để client không tự đặt loại giao dịch, actor hay số lượng trước/sau.
const stockMovementSchema = z.object({
  quantity: quantitySchema.min(1),
  note: noteSchema,
}).strict();

// Kiểm kê nhận tổng tồn thực tế mới; 0 hợp lệ để ghi nhận kho đã hết hàng.
const stockAdjustmentSchema = z.object({
  quantity: quantitySchema,
  note: noteSchema,
}).strict();

const stockThresholdSchema = z.object({
  lowStockThreshold: quantitySchema,
}).strict();

const paginationFields = {
  page: z.coerce.number().int().min(1).max(1000000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
};

const inventoryQuerySchema = z.object({
  ...paginationFields,
  variantId: variantIdSchema.optional(),
  sku: z.string().trim().min(1).max(200).toUpperCase().optional(),
}).strict();

// Lịch sử dùng cùng page/limit với danh sách kho; Zod kiểm tra ID và chặn query ngoài danh sách.
// Type lấy từ cùng hằng số với model, gồm cả giao dịch đơn hàng; không tự định nghĩa enum khác.
// Giữ bộ lọc thời gian hiện có, bắt buộc ISO có múi giờ và from không sau to.
const transactionQuerySchema = z.object({
  ...paginationFields,
  variantId: variantIdSchema.optional(),
  type: z.enum(STOCK_TRANSACTION_TYPES).optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
}).strict().refine(
  (data) => !data.from || !data.to || new Date(data.from) <= new Date(data.to),
  { message: "from must not be later than to", path: ["to"] }
);

const validateVariantId = (req, res, next) => {
  if (!variantIdSchema.safeParse(req.params.variantId).success) {
    return res.status(400).json({ message: "Invalid variant ID" });
  }
  return next();
};

module.exports = {
  variantIdSchema,
  stockMovementSchema,
  stockAdjustmentSchema,
  stockThresholdSchema,
  inventoryQuerySchema,
  transactionQuerySchema,
  validateVariantId,
};
