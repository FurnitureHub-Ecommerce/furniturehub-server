/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Tiếp nhận HTTP request và trả kết quả kiểm tra checkout theo convention dự án.
 *
 * Bước 1: Import Checkout Service.
 * Bước 2: Lấy userId từ JWT và addressId từ body đã kiểm tra.
 * Bước 3: Trả HTTP 200 hoặc 400 theo kết quả; xử lý lỗi địa chỉ và lỗi hệ thống.
 */

const checkoutService = require("../services/checkout.service");

/**
 * Đầu vào: req.user do authMiddleware gắn, req.body do validate kiểm tra.
 * Không sử dụng userId/cartId trong body hay query để chọn giỏ của người khác.
 * Gọi Service và trả 200 khi valid=true, 400 khi giỏ hàng không hợp lệ.
 * Lỗi Address Service giữ statusCode và message như Address API (400/404).
 * Lỗi ngoài dự kiến trả 500 với thông báo chung, không trả stack hoặc nội dung
 * lỗi database vì có thể chứa thông tin kết nối hay dữ liệu riêng tư.
 */
const validateCheckout = async (req, res) => {
  try {
    const result = await checkoutService.validateCheckout(
      req.user.userId,
      req.body.addressId
    );

    return res.status(result.valid ? 200 : 400).json(result);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      message: statusCode === 500 ? "Internal server error" : error.message,
    });
  }
};

module.exports = { validateCheckout };
