/**
 * @Author: Minh Truong
 * Mục đích: chuyển request Order đã xác thực sang Service và trả JSON theo dự án.
 */
const orderService = require("../services/order.service");

/**
 * Trả lỗi nghiệp vụ và phân quyền đã định nghĩa; 503 khi database không hỗ trợ transaction.
 * Lỗi Cart trả nguyên chẩn đoán từ Task 3 để client xác định dòng thiếu hàng/sai giá.
 * Các lỗi database hoặc lỗi ngoài dự kiến trả 500 chung, không gửi stack/URI.
 */
const handleError = (res, error) => {
  const statusCode = [400, 401, 403, 404, 409, 503].includes(error.statusCode) ? error.statusCode : 500;
  if (statusCode === 400 && error.details) return res.status(400).json(error.details);
  return res.status(statusCode).json({
    message: statusCode === 500 ? "Internal server error" : error.message,
  });
};

/**
 * Nhận req.user từ JWT và body chỉ gồm addressId đã kiểm tra.
 * Gọi Service tạo đủ Order/items, chờ lưu xong rồi trả 201 cùng message và order.
 * Bất kỳ bước kiểm tra/ghi nào lỗi đều đi qua handleError, không trả thành công.
 */
const createOrder = async (req, res) => {
  try {
    const order = await orderService.createOrder(req.user.userId, req.body.addressId);
    return res.status(201).json({ message: "Order created successfully", order });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Nhận id từ URL và userId từ JWT, gọi Service kiểm tra ID/quyền sở hữu.
 * Trả 200 với { order } gồm toàn bộ snapshot; 400/404/500 qua handleError.
 * Không đọc userId/cartId từ query hoặc body và không populate thông tin User.
 */
const getOrderById = async (req, res) => {
  try {
    const order = await orderService.getOrderById(req.user.userId, req.params.id);
    return res.status(200).json({ order });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Chuyển ID và status đã validate tới Service sau khi Route kiểm tra STAFF/ADMIN.
 * Confirmed/rejected/cancelled được chuyển sang Service chuyên biệt có xử lý kho.
 * Controller không tự ghi status.
 */
const updateOrderStatus = async (req, res) => {
  try {
    const order = await orderService.updateOrderStatus(req.params.id, req.body.status, req.user);
    return res.status(200).json({ message: "Order status updated successfully", order });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Mục đích: xác nhận đơn hàng (pending → confirmed) bởi STAFF hoặc ADMIN.
 * Nhận id từ URL đã qua validateOrderId; không cần body.
 * Gọi Service thực hiện đầy đủ nghiệp vụ: kiểm tra tồn kho, trừ kho, cập nhật status.
 * Thành công trả 200 với { message, data }; mọi lỗi đi qua handleError.
 * Không tự trừ kho hoặc ghi Order trong Controller.
 */
const confirmOrder = async (req, res) => {
  try {
    const order = await orderService.confirmOrder(req.params.id, req.user);
    return res.status(200).json({
      message: "Order confirmed successfully",
      data: order,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Mục đích: từ chối đơn hàng (pending/confirmed → rejected) bởi STAFF hoặc ADMIN.
 * Nhận id từ URL đã qua validateOrderId; không cần body.
 * Gọi Service kiểm tra quy tắc trạng thái và cập nhật Order an toàn.
 * Pending chưa trừ kho; confirmed phải hoàn kho và ghi người thực hiện từ JWT.
 * Thành công trả 200 với { message, data }; mọi lỗi đi qua handleError.
 */
const rejectOrder = async (req, res) => {
  try {
    const order = await orderService.rejectOrder(req.params.id, req.user);
    return res.status(200).json({
      message: "Order rejected successfully",
      data: order,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Hủy đơn hàng (pending/confirmed → cancelled) bởi CUSTOMER (chính chủ), STAFF hoặc ADMIN.
 * Nhận id từ URL đã qua validateOrderId; không cần body.
 * Gọi Service thực hiện đầy đủ nghiệp vụ:
 * - Kiểm tra quyền sở hữu (CUSTOMER chỉ hủy đơn của chính mình).
 * - Kiểm tra trạng thái pending/confirmed hợp lệ.
 * - Kiểm tra tình trạng thanh toán và nghiệp vụ tồn kho.
 * - Hoàn kho nếu đã confirmed; cập nhật Order kèm trạng thái nguồn trong cùng transaction.
 * Thành công trả 200 với { message, data }; mọi lỗi đi qua handleError.
 */
const cancelOrder = async (req, res) => {
  try {
    const order = await orderService.cancelOrder(req.params.id, req.user);
    return res.status(200).json({
      message: "Order cancelled successfully",
      data: order,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

module.exports = {
  createOrder,
  getOrderById,
  updateOrderStatus,
  confirmOrder,
  rejectOrder,
  cancelOrder,
};
