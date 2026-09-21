/**
 * @Author: Minh Truong
 * Mục đích: kiểm tra đầu vào hai API Order bằng Zod hiện tại.
 * POST chỉ nhận addressId dạng ObjectId; trường lạ bị từ chối, không âm thầm bỏ qua.
 * GET yêu cầu id dạng ObjectId trước khi query. Lỗi đầu vào trả 400.
 * Quyền sở hữu được Service kiểm tra bằng userId từ JWT, không từ client.
 */
const { z } = require("zod");
const { validateCheckoutSchema } = require("./checkout.validator");

const createOrderSchema = validateCheckoutSchema;
const orderIdSchema = z.string().regex(/^[a-fA-F0-9]{24}$/, { message: "Invalid order ID" });

module.exports = { createOrderSchema, orderIdSchema };
