/**
 * @Author: Minh Truong
 * Mục đích: chuyển request Order đã xác thực sang Service và trả JSON theo dự án.
 */
const orderService = require("../services/order.service");

/**
 * Nhận lỗi Service và response; chỉ công bố lỗi nghiệp vụ 400/404/409 đã định nghĩa.
 * Lỗi Cart trả nguyên chẩn đoán từ Task 3 để client xác định dòng thiếu hàng/sai giá.
 * Các lỗi database hoặc lỗi ngoài dự kiến trả 500 chung, không gửi stack/URI.
 */
const handleError = (res, error) => {
  const statusCode = [400, 404, 409].includes(error.statusCode) ? error.statusCode : 500;
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
 * Service hiện chặn mọi chuyển trạng thái bằng 409 vì nghiệp vụ chưa sẵn sàng.
 * Hợp đồng 200 với { message, order } chỉ dùng khi Service hoàn thành toàn bộ
 * nghiệp vụ ở task sau; Controller không tự ghi status hoặc giả lập thành công.
 */
const updateOrderStatus = async (req, res) => {
  try {
    const order = await orderService.updateOrderStatus(req.params.id, req.body.status);
    return res.status(200).json({ message: "Order status updated successfully", order });
  } catch (error) {
    return handleError(res, error);
  }
};

module.exports = { createOrder, getOrderById, updateOrderStatus };
