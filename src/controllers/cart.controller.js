/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Xử lý HTTP Request và Response cho Cart API.
 *
 * Bước 1: Import Cart Service.
 * Bước 2: Tạo hàm xử lý lỗi.
 * Bước 3: Lấy giỏ hàng và tính toán tổng tiền.
 * Bước 4: Xử lý thêm sản phẩm vào giỏ hàng.
 * Bước 5: Cập nhật số lượng CartItem.
 * Bước 6: Xóa một CartItem.
 * Bước 7: Xóa toàn bộ giỏ hàng.
 * Bước 8: Export các hàm cho Route.
 *
 * Trách nhiệm của Controller:
 * - Đọc dữ liệu từ req (params, body, user).
 * - Gọi Service xử lý nghiệp vụ.
 * - Trả response đúng định dạng và HTTP status code.
 * - KHÔNG chứa logic nghiệp vụ hoặc truy vấn database.
 */

const cartService = require("../services/cart.service");

/**
 * Bước 2: Xử lý lỗi.
 *
 * - Nhận lỗi được Service ném ra.
 * - Đọc statusCode từ lỗi nghiệp vụ.
 * - Nếu không có statusCode, mặc định HTTP 500.
 * - Ẩn thông báo lỗi hệ thống với Client khi status 500.
 * - Trả về JSON chứa thông báo lỗi cho Client.
 */
const handleError = (res, error) => {
  console.error(error);

  const statusCode = error.statusCode || 500;

  return res.status(statusCode).json({
    message:
      statusCode === 500
        ? "Internal server error"
        : error.message,
  });
};

/**
 * Bước 3: Lấy giỏ hàng của CUSTOMER đang đăng nhập.
 *
 * Quy trình:
 * 1. Lấy userId từ JWT đã xác thực.
 *    Không lấy userId từ query string để tránh xem giỏ hàng người khác.
 * 2. Gọi Service lấy Cart và tính toán.
 * 3. Trả HTTP 200 cùng dữ liệu đầy đủ:
 *    - items với itemSubtotal từng dòng.
 *    - totalQuantity và totalAmount toàn giỏ.
 * 4. Nếu chưa có Cart, Service trả về cấu trúc rỗng.
 *    Controller không phân biệt trường hợp này, đều trả HTTP 200.
 */
const getCart = async (req, res) => {
  try {
    // Lấy userId từ JWT đã xác thực.
    const userId = req.user.userId;

    // Gọi Service lấy giỏ hàng và tính toán.
    const cart = await cartService.getCart(userId);

    return res.status(200).json({ cart });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Bước 4: Thêm sản phẩm vào giỏ hàng.
 *
 * Quy trình:
 * 1. Lấy userId từ req.user do Auth Middleware cung cấp.
 *    Không lấy userId từ body để tránh thao tác giỏ hàng người khác.
 * 2. Lấy variantId và quantity từ request body.
 *    Body đã được Zod Validator xử lý trước đó.
 * 3. Gọi Service thực hiện toàn bộ nghiệp vụ:
 *    - Kiểm tra Variant và Product còn hoạt động.
 *    - Kiểm tra tồn kho đủ.
 *    - Thêm item hoặc tăng quantity nếu đã có.
 * 4. Trả HTTP 201 cùng Cart đã cập nhật.
 *
 * Các lỗi nghiệp vụ được Service xử lý:
 * - variantId không hợp lệ: 400.
 * - Variant không tồn tại hoặc inactive: 404.
 * - Product không tồn tại hoặc inactive: 404.
 * - Tồn kho không đủ: 400.
 */
const addItem = async (req, res) => {
  try {
    // Lấy userId từ JWT đã xác thực, không từ body.
    const userId = req.user.userId;

    // Lấy dữ liệu đã được Validator kiểm tra.
    const { variantId, quantity } = req.body;

    // Gọi Service thực hiện nghiệp vụ thêm vào giỏ.
    const cart = await cartService.addItem(
      userId,
      variantId,
      quantity
    );

    return res.status(201).json({
      message: "Item added to cart successfully",
      cart,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Bước 5: Cập nhật số lượng một CartItem.
 *
 * Quy trình:
 * 1. Lấy userId từ JWT đã xác thực.
 * 2. Lấy itemId từ URL params.
 * 3. Lấy quantity mới từ body (đã được Validator kiểm tra).
 * 4. Gọi Service kiểm tra item và tồn kho, cập nhật quantity.
 * 5. Trả HTTP 200 cùng Cart đã cập nhật.
 *
 * Các lỗi nghị vụ được Service xử lý:
 * - itemId không hợp lệ: 400.
 * - CartItem không tồn tại: 404.
 * - Tồn kho không đủ: 400.
 */
const updateItem = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Lấy itemId từ URL. Ví dụ: PATCH /api/cart/items/abc123
    const { itemId } = req.params;

    // Lấy quantity mới từ body đã qua Validator.
    const { quantity } = req.body;

    const cart = await cartService.updateItem(
      userId,
      itemId,
      quantity
    );

    return res.status(200).json({
      message: "Cart item updated successfully",
      cart,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Bước 6: Xóa một CartItem khỏi giỏ hàng.
 *
 * Quy trình:
 * 1. Lấy userId từ JWT.
 * 2. Lấy itemId từ URL params.
 * 3. Gọi Service tìm và xóa đúng item của User.
 * 4. Trả HTTP 200 cùng Cart sau khi xóa.
 *
 * Xóa item không xóa sản phẩm khỏi database.
 * Xóa item không ảnh hưởng Inventory.
 */
const removeItem = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Lấy itemId từ URL. Ví dụ: DELETE /api/cart/items/abc123
    const { itemId } = req.params;

    const cart = await cartService.removeItem(userId, itemId);

    return res.status(200).json({
      message: "Cart item removed successfully",
      cart,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Bước 7: Xóa toàn bộ giỏ hàng.
 *
 * Quy trình:
 * 1. Lấy userId từ JWT.
 * 2. Gọi Service làm rỗng mảng items.
 * 3. Trả HTTP 200 với thông báo thành công.
 *    Không trả lại Cart để giảm payload.
 *    Frontend có thể gọi lại GET /api/cart nếu cần xác nhận.
 *
 * Thao tác idempotent:
 * Gọi nhiều lần vẫn trả về thành công.
 */
const clearCart = async (req, res) => {
  try {
    const userId = req.user.userId;

    await cartService.clearCart(userId);

    return res.status(200).json({
      message: "Cart cleared successfully",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// Bước 8: Export các hàm cho Route sử dụng.
module.exports = {
  getCart,
  addItem,
  updateItem,
  removeItem,
  clearCart,
};
