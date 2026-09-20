/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Xử lý HTTP Request và Response cho Wishlist API.
 *
 * Bước 1: Import Wishlist Service.
 * Bước 2: Tạo hàm xử lý lỗi.
 * Bước 3: Lấy danh sách sản phẩm yêu thích.
 * Bước 4: Thêm sản phẩm vào Wishlist.
 * Bước 5: Xóa sản phẩm khỏi Wishlist.
 * Bước 6: Export các hàm cho Route.
 */

const wishlistService = require("../services/wishlist.service");

/**
 * Bước 2: Xử lý lỗi.
 *
 * - Nhận lỗi được Service ném ra.
 * - Lấy statusCode từ lỗi nghiệp vụ.
 * - Nếu không có statusCode, mặc định HTTP 500.
 * - Không trả thông tin lỗi hệ thống cho Client.
 * - Trả về JSON chứa thông báo lỗi.
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
 * Bước 3: Lấy danh sách yêu thích.
 *
 * Quy trình:
 * 1. Lấy userId từ req.user do Auth Middleware cung cấp.
 * 2. Gọi Service để lấy Wishlist của User.
 * 3. Trả danh sách Wishlist với HTTP 200.
 * 4. Nếu xảy ra lỗi, chuyển sang handleError.
 *
 * Không lấy userId từ req.body hoặc req.query
 * để tránh truy cập Wishlist của người khác.
 */
const getAll = async (req, res) => {
  try {
    const userId = req.user.userId;

    const wishlist = await wishlistService.getAll(userId);

    return res.status(200).json({
      wishlist,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Bước 4: Thêm sản phẩm vào Wishlist.
 *
 * Quy trình:
 * 1. Lấy userId từ JWT đã xác thực.
 * 2. Lấy productId từ request body.
 * 3. Gọi Service kiểm tra Product và dữ liệu trùng.
 * 4. Tạo Wishlist mới nếu hợp lệ.
 * 5. Trả HTTP 201 cùng dữ liệu vừa tạo.
 *
 * Các lỗi nghiệp vụ được Service xử lý:
 * - Product ID không hợp lệ: 400.
 * - Product không tồn tại hoặc inactive: 404.
 * - Product đã được yêu thích: 409.
 */
const add = async (req, res) => {
  try {
    const userId = req.user.userId;

    const { productId } = req.body;

    const wishlist = await wishlistService.add(
      userId,
      productId
    );

    return res.status(201).json({
      message: "Product added to wishlist successfully",
      wishlist,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Bước 5: Xóa sản phẩm khỏi Wishlist.
 *
 * Quy trình:
 * 1. Lấy userId từ JWT đã xác thực.
 * 2. Lấy productId từ URL.
 * 3. Gọi Service tìm và xóa đúng Wishlist của User.
 * 4. Nếu thành công, trả HTTP 200.
 * 5. Nếu sản phẩm không có trong Wishlist, trả 404.
 *
 * Việc xóa Wishlist không xóa Product khỏi database.
 */
const remove = async (req, res) => {
  try {
    const userId = req.user.userId;

    const { productId } = req.params;

    await wishlistService.remove(userId, productId);

    return res.status(200).json({
      message: "Product removed from wishlist successfully",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// Bước 6: Export các hàm cho Route sử dụng.
module.exports = {
  getAll,
  add,
  remove,
};