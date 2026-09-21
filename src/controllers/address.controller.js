/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Xử lý HTTP Request và Response cho Address API.
 *
 * Bước 1: Import Address Service.
 * Bước 2: Tạo hàm xử lý lỗi chung.
 * Bước 3: Lấy danh sách địa chỉ của Customer.
 * Bước 4: Lấy chi tiết một địa chỉ.
 * Bước 5: Tạo địa chỉ mới.
 * Bước 6: Cập nhật địa chỉ.
 * Bước 7: Đặt địa chỉ làm mặc định.
 * Bước 8: Xóa địa chỉ.
 * Bước 9: Export các hàm cho Route.
 *
 * Trách nhiệm của Controller:
 * - Đọc dữ liệu từ req (params, body, user).
 * - Gọi Service xử lý nghiệp vụ.
 * - Trả response đúng định dạng và HTTP status code.
 * - KHÔNG chứa logic nghiệp vụ hoặc truy vấn database.
 *
 * Tất cả endpoint Address đều:
 * - Yêu cầu JWT hợp lệ (authMiddleware đã xử lý trước).
 * - Chỉ cho phép role CUSTOMER (authorizeRoles đã xử lý trước).
 * - userId luôn lấy từ req.user.userId, không từ request.
 */

const addressService = require("../services/address.service");

/**
 * Bước 2: Xử lý lỗi chung.
 *
 * - Nhận lỗi được Service ném ra.
 * - Đọc statusCode từ lỗi nghiệp vụ (do makeError() gắn vào).
 * - Nếu không có statusCode, mặc định HTTP 500.
 * - Ẩn thông báo lỗi hệ thống với Client khi status 500.
 * - Trả về JSON chứa thông báo lỗi cho Client.
 *
 * Giữ nguyên convention với cart.controller.js để nhất quán.
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
 * Bước 3: Lấy danh sách địa chỉ của Customer đang đăng nhập.
 *
 * Quy trình:
 * 1. Lấy userId từ JWT đã xác thực.
 *    Không lấy userId từ query string để tránh xem địa chỉ người khác.
 * 2. Gọi Service lấy danh sách địa chỉ của Customer.
 * 3. Trả HTTP 200 cùng danh sách (có thể là mảng rỗng nếu chưa có địa chỉ).
 *
 * GET /api/addresses
 * Response 200: Danh sách địa chỉ, sắp xếp mặc định trước.
 * Response 401: Chưa đăng nhập.
 * Response 403: Không phải CUSTOMER.
 */
const getMyAddresses = async (req, res) => {
  try {
    // Lấy userId từ JWT, không từ query string.
    const userId = req.user.userId;

    // Gọi Service lấy danh sách địa chỉ.
    const addresses = await addressService.getMyAddresses(userId);

    return res.status(200).json({ addresses });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Bước 4: Lấy chi tiết một địa chỉ.
 *
 * Quy trình:
 * 1. Lấy userId từ JWT.
 * 2. Lấy addressId từ URL params.
 * 3. Gọi Service tìm địa chỉ, kiểm tra quyền sở hữu.
 * 4. Trả HTTP 200 cùng dữ liệu địa chỉ.
 *
 * GET /api/addresses/:id
 * Response 200: Chi tiết địa chỉ.
 * Response 400: Address ID không hợp lệ.
 * Response 401: Chưa đăng nhập.
 * Response 403: Không phải CUSTOMER.
 * Response 404: Không tìm thấy địa chỉ hoặc không phải của Customer.
 */
const getAddressById = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Lấy addressId từ URL. Ví dụ: GET /api/addresses/507f1f77bcf86cd799439011
    const { id } = req.params;

    // Gọi Service tìm địa chỉ và kiểm tra quyền sở hữu.
    const address = await addressService.getAddressById(userId, id);

    return res.status(200).json({ address });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Bước 5: Tạo địa chỉ mới.
 *
 * Quy trình:
 * 1. Lấy userId từ JWT.
 *    Không lấy userId từ body để tránh tạo địa chỉ giả mạo chủ sở hữu.
 * 2. Lấy dữ liệu địa chỉ từ body (đã qua Validator).
 * 3. Gọi Service tạo địa chỉ, tự động xác định isDefault.
 * 4. Trả HTTP 201 cùng địa chỉ vừa tạo.
 *
 * POST /api/addresses
 * Body: receiverName, phone, addressLine, ward, city.
 * Response 201: Địa chỉ vừa tạo (với isDefault tự động).
 * Response 400: Dữ liệu không hợp lệ (Validator đã xử lý trước).
 * Response 401: Chưa đăng nhập.
 * Response 403: Không phải CUSTOMER.
 */
const createAddress = async (req, res) => {
  try {
    // Lấy userId từ JWT, không từ body.
    const userId = req.user.userId;

    // Lấy dữ liệu đã được Validator kiểm tra và làm sạch.
    const data = req.body;

    // Gọi Service tạo địa chỉ và xác định isDefault tự động.
    const address = await addressService.createAddress(userId, data);

    return res.status(201).json({
      message: "Tạo địa chỉ thành công",
      address,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Bước 6: Cập nhật thông tin địa chỉ (cập nhật toàn phần).
 *
 * Quy trình:
 * 1. Lấy userId từ JWT.
 * 2. Lấy addressId từ URL params.
 * 3. Lấy dữ liệu mới từ body (đã qua Validator).
 * 4. Gọi Service cập nhật địa chỉ và kiểm tra quyền sở hữu.
 * 5. Trả HTTP 200 cùng địa chỉ sau khi cập nhật.
 *
 * PUT /api/addresses/:id
 * Body: receiverName, phone, addressLine, ward, city (bắt buộc đủ trường).
 * Response 200: Địa chỉ sau khi cập nhật.
 * Response 400: Address ID không hợp lệ hoặc dữ liệu không hợp lệ.
 * Response 401: Chưa đăng nhập.
 * Response 403: Không phải CUSTOMER.
 * Response 404: Không tìm thấy địa chỉ.
 *
 * Lưu ý: isDefault KHÔNG thay đổi qua endpoint này.
 * Sử dụng PATCH /api/addresses/:id/default để thay đổi địa chỉ mặc định.
 */
const updateAddress = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Lấy addressId từ URL.
    const { id } = req.params;

    // Lấy dữ liệu đã qua Validator.
    const data = req.body;

    // Gọi Service cập nhật địa chỉ, kiểm tra quyền sở hữu.
    const address = await addressService.updateAddress(
      userId,
      id,
      data
    );

    return res.status(200).json({
      message: "Cập nhật địa chỉ thành công",
      address,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Bước 7: Đặt địa chỉ làm mặc định.
 *
 * Quy trình:
 * 1. Lấy userId từ JWT.
 * 2. Lấy addressId từ URL params.
 * 3. Gọi Service bỏ mặc định địa chỉ cũ, đặt mặc định địa chỉ mới.
 * 4. Trả HTTP 200 cùng địa chỉ đã được đặt làm mặc định.
 *
 * PATCH /api/addresses/:id/default
 * Không cần request body.
 * Response 200: Địa chỉ đã được đặt làm mặc định.
 * Response 400: Address ID không hợp lệ.
 * Response 401: Chưa đăng nhập.
 * Response 403: Không phải CUSTOMER.
 * Response 404: Không tìm thấy địa chỉ.
 *
 * Endpoint riêng (không dùng PUT) để tách biệt nghiệp vụ:
 * - PUT: cập nhật thông tin địa chỉ.
 * - PATCH /default: chỉ thay đổi trạng thái mặc định.
 */
const setDefaultAddress = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Lấy addressId từ URL. Ví dụ: PATCH /api/addresses/507f.../default
    const { id } = req.params;

    // Gọi Service xử lý logic đặt mặc định.
    const address = await addressService.setDefaultAddress(userId, id);

    return res.status(200).json({
      message: "Đặt địa chỉ mặc định thành công",
      address,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

/**
 * Bước 8: Xóa địa chỉ.
 *
 * Quy trình:
 * 1. Lấy userId từ JWT.
 * 2. Lấy addressId từ URL params.
 * 3. Gọi Service xóa địa chỉ và xử lý logic mặc định.
 * 4. Trả HTTP 200 với thông báo thành công.
 *
 * DELETE /api/addresses/:id
 * Không cần request body.
 * Response 200: Xóa thành công.
 * Response 400: Address ID không hợp lệ.
 * Response 401: Chưa đăng nhập.
 * Response 403: Không phải CUSTOMER.
 * Response 404: Không tìm thấy địa chỉ.
 *
 * Xóa địa chỉ mặc định → Service tự động chuyển mặc định sang địa chỉ cũ nhất còn lại.
 * Xóa địa chỉ cuối cùng → không còn địa chỉ mặc định, không lỗi.
 */
const deleteAddress = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Lấy addressId từ URL.
    const { id } = req.params;

    // Gọi Service xóa địa chỉ và xử lý chuyển mặc định nếu cần.
    await addressService.deleteAddress(userId, id);

    return res.status(200).json({
      message: "Xóa địa chỉ thành công",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

// Bước 9: Export các hàm cho Route sử dụng.
module.exports = {
  getMyAddresses,
  getAddressById,
  createAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
};
