/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Xử lý nghiệp vụ danh sách yêu thích của FurnitureHub.
 *
 * Bước 1: Import Mongoose và các Repository.
 * Bước 2: Tạo hàm xử lý lỗi nghiệp vụ.
 * Bước 3: Kiểm tra Product ID hợp lệ.
 * Bước 4: Lấy danh sách Wishlist của User.
 * Bước 5: Thêm sản phẩm vào Wishlist.
 * Bước 6: Xóa sản phẩm khỏi Wishlist.
 * Bước 7: Export các hàm cho Controller.
 */

const mongoose = require("mongoose");

const wishlistRepository = require(
  "../repositories/wishlist.repository"
);

const productRepository = require(
  "../repositories/product.repository"
);

/**
 * Bước 2: Tạo lỗi nghiệp vụ.
 *
 * - Nhận thông báo lỗi và HTTP status.
 * - Tạo đối tượng Error.
 * - Gắn statusCode để Controller xử lý.
 * - Trả về lỗi cho hàm gọi.
 */
const makeError = (message, statusCode) => {
  const error = new Error(message);

  error.statusCode = statusCode;

  return error;
};

/**
 * Bước 3: Kiểm tra Product ID.
 *
 * - ID phải là chuỗi ObjectId hợp lệ.
 * - Nếu ID không hợp lệ, trả HTTP 400.
 * - Tránh thực hiện truy vấn với ID sai định dạng.
 */
const validateProductId = (productId) => {
  if (
    typeof productId !== "string" ||
    !mongoose.isObjectIdOrHexString(productId)
  ) {
    throw makeError("Invalid product ID", 400);
  }
};

/**
 * Bước 4: Lấy Wishlist của khách hàng.
 *
 * - Nhận userId từ Controller.
 * - userId được lấy từ JWT đã xác thực.
 * - Gọi Repository tìm các Wishlist thuộc User.
 * - Trả về danh sách cho Controller.
 *
 * Nếu User chưa có Wishlist, kết quả là mảng rỗng.
 */
const getAll = async (userId) => {
  return wishlistRepository.findByUserId(userId);
};

/**
 * Bước 5: Thêm sản phẩm vào Wishlist.
 *
 * Quy trình:
 *
 * 1. Nhận userId và productId.
 * 2. Kiểm tra định dạng productId.
 * 3. Kiểm tra Product tồn tại.
 * 4. Kiểm tra Product đang hoạt động.
 * 5. Kiểm tra User đã yêu thích Product chưa.
 * 6. Nếu chưa, tạo bản ghi Wishlist mới.
 * 7. Trả về bản ghi vừa tạo.
 *
 * Các trường hợp lỗi:
 *
 * - ID không hợp lệ: 400.
 * - Product không tồn tại hoặc inactive: 404.
 * - Product đã trong Wishlist: 409.
 */
const add = async (userId, productId) => {
  // Bước 1: Kiểm tra định dạng Product ID.
  validateProductId(productId);

  // Bước 2: Tìm Product trong database.
  const product = await productRepository.findById(
    productId
  );

  // Bước 3: Không cho yêu thích sản phẩm
  // không tồn tại hoặc đã ngừng hoạt động.
  if (!product || !product.isActive) {
    throw makeError("Product not found", 404);
  }

  // Bước 4: Kiểm tra sản phẩm đã được yêu thích chưa.
  const existingWishlist =
    await wishlistRepository.findByUserAndProduct(
      userId,
      productId
    );

  // Bước 5: Từ chối nếu sản phẩm đã tồn tại.
  if (existingWishlist) {
    throw makeError(
      "Product already exists in wishlist",
      409
    );
  }

  // Bước 6: Tạo bản ghi Wishlist mới.
  try {
    return await wishlistRepository.create(
      userId,
      productId
    );
  } catch (error) {
    // Unique index ngăn hai request đồng thời
    // tạo trùng cùng một cặp userId và productId.
    // Chuyển lỗi MongoDB thành HTTP 409.
    if (error.code === 11000) {
      throw makeError(
        "Product already exists in wishlist",
        409
      );
    }

    // Các lỗi database khác được chuyển tiếp.
    throw error;
  }
};

/**
 * Bước 6: Xóa sản phẩm khỏi Wishlist.
 *
 * Quy trình:
 *
 * 1. Nhận userId và productId.
 * 2. Kiểm tra định dạng Product ID.
 * 3. Tìm và xóa Wishlist theo cả hai ID.
 * 4. Nếu không tìm thấy, trả lỗi 404.
 * 5. Trả về document đã xóa.
 *
 * Không cần kiểm tra Product.isActive vì khách hàng
 * vẫn phải có khả năng xóa sản phẩm đã ngừng bán
 * khỏi Wishlist của mình.
 */
const remove = async (userId, productId) => {
  // Bước 1: Kiểm tra ID hợp lệ.
  validateProductId(productId);

  // Bước 2: Tìm và xóa đúng bản ghi của User.
  const wishlist = await wishlistRepository.remove(
    userId,
    productId
  );

  // Bước 3: Nếu không có bản ghi, trả lỗi 404.
  if (!wishlist) {
    throw makeError(
      "Product not found in wishlist",
      404
    );
  }

  // Bước 4: Trả về bản ghi đã xóa.
  return wishlist;
};

// Bước 7: Export các hàm cho Controller.
module.exports = {
  getAll,
  add,
  remove,
};