/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Xử lý HTTP Request và Response cho ProductVariant API.
 *
 * Bước 1: Import ProductVariant Service.
 * Bước 2: Tạo hàm xử lý lỗi từ Service và MongoDB.
 * Bước 3: Tạo hàm lấy danh sách Variant theo Product.
 * Bước 4: Tạo hàm lấy danh sách Variant dành cho Admin.
 * Bước 5: Tạo hàm lấy chi tiết Variant theo ID.
 * Bước 6: Tạo hàm thêm Variant.
 * Bước 7: Tạo hàm cập nhật Variant.
 * Bước 8: Tạo hàm xóa mềm Variant.
 * Bước 9: Export các hàm cho Route sử dụng.
 */

const variantService = require("../services/productVariant.service");

/**
 * Bước 2: Xử lý lỗi.
 *
 * - Nhận lỗi từ Service hoặc MongoDB.
 * - Nếu MongoDB báo trùng unique index, trả 409.
 * - Nếu lỗi có statusCode, sử dụng status đó.
 * - Các lỗi không xác định trả 500.
 * - Không gửi chi tiết lỗi hệ thống cho client.
 */
const handleError = (res, error) => {
  console.error(error);

  const statusCode =
    error.code === 11000
      ? 409
      : error.statusCode || 500;

  return res.status(statusCode).json({
    message:
      statusCode === 500
        ? "Internal server error"
        : error.code === 11000
          ? "SKU already exists"
          : error.message,
  });
};

/**
 * Bước 3: Lấy danh sách Variant công khai.
 *
 * - Lấy productId từ URL.
 * - Gọi Service với quyền public.
 * - Chỉ lấy Variant đang hoạt động.
 * - Trả danh sách và HTTP 200.
 */
const getByProductId = async (req, res) => {
  try {
    const variants = await variantService.getByProductId(
      req.params.productId
    );

    return res.status(200).json({
      variants,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Bước 4: Lấy danh sách Variant dành cho Admin.
 *
 * - Lấy productId từ URL.
 * - Gọi Service với isAdmin = true.
 * - Lấy cả Variant đã bị vô hiệu hóa.
 * - Trả danh sách và HTTP 200.
 */
const getByProductIdAdmin = async (req, res) => {
  try {
    const variants = await variantService.getByProductId(
      req.params.productId,
      true
    );

    return res.status(200).json({
      variants,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Bước 5: Lấy chi tiết Variant.
 *
 * - Nhận Variant ID từ URL.
 * - Gọi Service tìm Variant.
 * - Trả thông tin Variant và HTTP 200.
 * - Nếu không tồn tại, trả lỗi tương ứng.
 */
const getById = async (req, res) => {
  try {
    const variant = await variantService.getById(
      req.params.id
    );

    return res.status(200).json({
      variant,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Bước 6: Tạo Variant mới.
 *
 * - Nhận productId từ URL.
 * - Nhận dữ liệu từ request body.
 * - Dữ liệu được kiểm tra bởi Zod tại Route.
 * - Gọi Service kiểm tra Product và SKU.
 * - Kiểm tra tổ hợp thuộc tính bị trùng.
 * - Lưu Variant vào MongoDB.
 * - Trả HTTP 201 và Variant vừa tạo.
 */
const create = async (req, res) => {
  try {
    const variant = await variantService.create(
      req.params.productId,
      req.body
    );

    return res.status(201).json({
      message: "Variant created successfully",
      variant,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Bước 7: Cập nhật Variant.
 *
 * - Nhận Variant ID từ URL.
 * - Nhận dữ liệu cần cập nhật từ body.
 * - Gọi Service kiểm tra và cập nhật Variant.
 * - Trả HTTP 200 và thông tin mới.
 */
const update = async (req, res) => {
  try {
    const variant = await variantService.update(
      req.params.id,
      req.body
    );

    return res.status(200).json({
      message: "Variant updated successfully",
      variant,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Bước 8: Xóa mềm Variant.
 *
 * - Nhận Variant ID từ URL.
 * - Gọi Service tìm Variant.
 * - Chuyển isActive thành false.
 * - Không xóa document khỏi database.
 * - Trả HTTP 200.
 */
const remove = async (req, res) => {
  try {
    await variantService.remove(req.params.id);

    return res.status(200).json({
      message: "Variant deactivated successfully",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// Bước 9: Export các hàm.
module.exports = {
  getByProductId,
  getByProductIdAdmin,
  getById,
  create,
  update,
  remove,
};