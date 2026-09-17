/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Xử lý HTTP Request và Response cho Product API.
 *
 * Bước 1: Import Product Service.
 * Bước 2: Tạo hàm xử lý lỗi.
 * Bước 3: Viết hàm lấy danh sách Product công khai.
 * Bước 4: Viết hàm lấy danh sách Product cho Admin.
 * Bước 5: Viết hàm lấy chi tiết Product theo ID.
 * Bước 6: Viết hàm tạo Product.
 * Bước 7: Viết hàm cập nhật Product.
 * Bước 8: Viết hàm xóa mềm Product.
 * Bước 9: Export các hàm để Route sử dụng.
 */

const productService = require("../services/product.service");

/**
 * Bước 2: Xử lý lỗi.
 *
 * - Nhận response và lỗi từ Service.
 * - Lấy HTTP status từ lỗi.
 * - Nếu không có statusCode, mặc định là 500.
 * - Không trả thông tin lỗi hệ thống cho client.
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
 * Bước 3: Lấy danh sách Product công khai.
 *
 * - Nhận các tham số tìm kiếm từ req.query.
 * - Gọi Service xử lý tìm kiếm và lọc sản phẩm.
 * - Nhận danh sách và thông tin phân trang.
 * - Trả về dữ liệu với HTTP 200.
 * - Nếu có lỗi, chuyển sang hàm handleError.
 */
const getAll = async (req, res) => {
  try {

    // Gửi query parameters cho Service xử lý.
    const result = await productService.getCatalog(
      req.query
    );

    // Trả về danh sách và thông tin phân trang.
    return res.status(200).json({
      products: result.products,
      pagination: result.pagination,
    });

  } catch (error) {
    return handleError(res, error);
  }
};
/**
 * Bước 4: Lấy danh sách Product dành cho Admin.
 *
 * - Gọi Service với isAdmin = true.
 * - Lấy cả Product đang hoạt động và đã vô hiệu hóa.
 * - Trả danh sách và HTTP 200.
 */
const getAllAdmin = async (req, res) => {
  try {
    const products = await productService.getAll(true);

    return res.status(200).json({
      products,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Bước 5: Lấy chi tiết Product.
 *
 * - Nhận ID từ req.params.
 * - Gọi Service tìm Product.
 * - Trả thông tin Product và HTTP 200.
 * - Nếu ID sai hoặc không tìm thấy, trả lỗi tương ứng.
 */
const getById = async (req, res) => {
  try {
    const product = await productService.getById(
      req.params.id
    );

    return res.status(200).json({
      product,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Bước 6: Tạo Product.
 *
 * - Nhận dữ liệu từ req.body.
 * - Dữ liệu đã được Zod kiểm tra tại Route.
 * - Gọi Service để kiểm tra Category và Brand.
 * - Tạo Product trong MongoDB.
 * - Trả Product vừa tạo và HTTP 201.
 */
const create = async (req, res) => {
  try {
    const product = await productService.create(
      req.body
    );

    return res.status(201).json({
      message: "Product created successfully",
      product,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Bước 7: Cập nhật Product.
 *
 * - Nhận ID sản phẩm từ req.params.
 * - Nhận thông tin cần cập nhật từ req.body.
 * - Gọi Service kiểm tra và cập nhật Product.
 * - Trả dữ liệu mới và HTTP 200.
 */
const update = async (req, res) => {
  try {
    const product = await productService.update(
      req.params.id,
      req.body
    );

    return res.status(200).json({
      message: "Product updated successfully",
      product,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Bước 8: Xóa mềm Product.
 *
 * - Nhận ID sản phẩm.
 * - Gọi Service kiểm tra Product.
 * - Chuyển isActive thành false.
 * - Không xóa document khỏi MongoDB.
 * - Trả thông báo và HTTP 200.
 */
const remove = async (req, res) => {
  try {
    await productService.remove(req.params.id);

    return res.status(200).json({
      message: "Product deactivated successfully",
    });
  } catch (error) {
    return handleError(res, error);
  }
};


module.exports = {
  getAll,
  getAllAdmin,
  getById,
  create,
  update,
  remove,
};