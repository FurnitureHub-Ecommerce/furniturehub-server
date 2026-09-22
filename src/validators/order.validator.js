/**
 * @Author: Minh Truong
 * Mục đích: kiểm tra đầu vào các API Order bằng Zod hiện tại.
 * POST chỉ nhận addressId dạng ObjectId; trường lạ bị từ chối, không âm thầm bỏ qua.
 * GET yêu cầu id dạng ObjectId trước khi query. Lỗi đầu vào trả 400.
 * PATCH trạng thái kiểm tra ID trước body; chỉ nhận status thuộc enum.
 * Quyền sở hữu được Service kiểm tra bằng userId từ JWT, không từ client.
 */
const { z } = require("zod");
const { validateCheckoutSchema } = require("./checkout.validator");
const { ORDER_STATUSES } = require("../constants/orderStatus");

const createOrderSchema = validateCheckoutSchema;
const orderIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, { message: "Invalid order ID" });

// Không ép kiểu hay bỏ qua trường lạ: client không được sửa giá, items hoặc chủ đơn.
const updateOrderStatusSchema = z.object({
  status: z.enum(ORDER_STATUSES),
}).strict();

/**
 * Kiểm tra ID trên URL sau xác thực/phân quyền và trước validate body.
 * Sai định dạng trả 400 ngay, tránh CastError hoặc truy vấn database không cần thiết.
 * Không sửa middleware validate dùng chung vì middleware đó chỉ nhận req.body.
 */
const validateOrderId = (req, res, next) => {
  if (!orderIdSchema.safeParse(req.params.id).success) {
    return res.status(400).json({ message: "Invalid order ID" });
  }
  return next();
};

module.exports = {
  createOrderSchema,
  orderIdSchema,
  updateOrderStatusSchema,
  validateOrderId,
};
