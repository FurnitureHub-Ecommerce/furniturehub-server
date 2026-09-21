/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Định nghĩa các API quản lý địa chỉ giao hàng cho CUSTOMER.
 *
 * Bước 1: Import Express và Address Controller.
 * Bước 2: Import Middleware xác thực và phân quyền.
 * Bước 3: Import Validator, danh sách Role và Middleware validate.
 * Bước 4: Khởi tạo Express Router.
 * Bước 5: Đăng ký API lấy danh sách địa chỉ.
 * Bước 6: Đăng ký API tạo địa chỉ mới.
 * Bước 7: Đăng ký API lấy chi tiết địa chỉ.
 * Bước 8: Đăng ký API cập nhật địa chỉ.
 * Bước 9: Đăng ký API đặt địa chỉ làm mặc định.
 * Bước 10: Đăng ký API xóa địa chỉ.
 * Bước 11: Export Router.
 *
 * Tất cả Address API yêu cầu:
 * - JWT Authentication (authMiddleware).
 * - Role CUSTOMER (authorizeRoles).
 * - Customer chỉ thao tác được địa chỉ của chính mình.
 *   userId luôn lấy từ JWT, không từ request.
 */

const express = require("express");

const addressController = require("../controllers/address.controller");

const authMiddleware = require("../middlewares/auth.middleware");

const authorizeRoles = require("../middlewares/role.middleware");

const validate = require("../middlewares/validate.middleware");

const ROLES = require("../constants/roles");

const {
  createAddressSchema,
  updateAddressSchema,
} = require("../validators/address.validator");

// Bước 4: Khởi tạo Router.
const router = express.Router();

/**
 * Bước 5: API lấy danh sách địa chỉ của CUSTOMER.
 *
 * GET /api/addresses
 *
 * Middleware chain:
 * 1. authMiddleware: Xác thực JWT, gắn req.user.
 * 2. authorizeRoles(CUSTOMER): Chỉ CUSTOMER được xem địa chỉ.
 * 3. addressController.getMyAddresses: Lấy địa chỉ theo userId từ JWT.
 *
 * Response 200: Danh sách địa chỉ (mảng rỗng nếu chưa có).
 * Response 401: Chưa đăng nhập.
 * Response 403: Không phải CUSTOMER.
 */
router.get(
  "/",
  authMiddleware,
  authorizeRoles(ROLES.CUSTOMER),
  addressController.getMyAddresses
);

/**
 * Bước 6: API tạo địa chỉ mới.
 *
 * POST /api/addresses
 *
 * Middleware chain:
 * 1. authMiddleware: Xác thực JWT, gắn req.user.
 * 2. authorizeRoles(CUSTOMER): Chỉ CUSTOMER được tạo địa chỉ.
 * 3. validate(createAddressSchema): Kiểm tra dữ liệu đầu vào.
 * 4. addressController.createAddress: Xử lý nghiệp vụ và trả response.
 *
 * Body yêu cầu:
 * - receiverName: string, không rỗng.
 * - phone: string, số điện thoại Việt Nam.
 * - addressLine: string, không rỗng.
 * - ward: string, không rỗng.
 * - city: string, không rỗng.
 *
 * Response 201: Địa chỉ vừa tạo.
 * Response 400: Dữ liệu không hợp lệ.
 * Response 401: Chưa đăng nhập.
 * Response 403: Không phải CUSTOMER.
 */
router.post(
  "/",
  authMiddleware,
  authorizeRoles(ROLES.CUSTOMER),
  validate(createAddressSchema),
  addressController.createAddress
);

/**
 * Bước 7: API lấy chi tiết một địa chỉ.
 *
 * GET /api/addresses/:id
 *
 * Middleware chain:
 * 1. authMiddleware: Xác thực JWT.
 * 2. authorizeRoles(CUSTOMER): Chỉ CUSTOMER được xem.
 * 3. addressController.getAddressById: Tìm địa chỉ, kiểm tra quyền sở hữu.
 *
 * Params:
 * - id: _id của Address cần xem.
 *
 * Response 200: Chi tiết địa chỉ.
 * Response 400: Address ID không hợp lệ.
 * Response 401: Chưa đăng nhập.
 * Response 403: Không phải CUSTOMER.
 * Response 404: Không tìm thấy (hoặc không phải của Customer).
 */
router.get(
  "/:id",
  authMiddleware,
  authorizeRoles(ROLES.CUSTOMER),
  addressController.getAddressById
);

/**
 * Bước 8: API cập nhật địa chỉ (cập nhật toàn phần).
 *
 * PUT /api/addresses/:id
 *
 * Middleware chain:
 * 1. authMiddleware: Xác thực JWT.
 * 2. authorizeRoles(CUSTOMER): Chỉ CUSTOMER được cập nhật.
 * 3. validate(updateAddressSchema): Kiểm tra dữ liệu.
 * 4. addressController.updateAddress: Kiểm tra quyền sở hữu và cập nhật.
 *
 * Params:
 * - id: _id của Address cần cập nhật.
 *
 * Body yêu cầu đầy đủ:
 * - receiverName, phone, addressLine, ward, city.
 *
 * Các trường bị chặn (trả 400 nếu gửi):
 * - userId, isDefault, _id, createdAt, updatedAt.
 *
 * Response 200: Địa chỉ sau khi cập nhật.
 * Response 400: ID không hợp lệ hoặc dữ liệu không hợp lệ.
 * Response 401: Chưa đăng nhập.
 * Response 403: Không phải CUSTOMER.
 * Response 404: Không tìm thấy địa chỉ.
 */
router.put(
  "/:id",
  authMiddleware,
  authorizeRoles(ROLES.CUSTOMER),
  validate(updateAddressSchema),
  addressController.updateAddress
);

/**
 * Bước 9: API đặt địa chỉ làm mặc định.
 *
 * PATCH /api/addresses/:id/default
 *
 * Middleware chain:
 * 1. authMiddleware: Xác thực JWT.
 * 2. authorizeRoles(CUSTOMER): Chỉ CUSTOMER được thay đổi.
 * 3. addressController.setDefaultAddress: Bỏ mặc định cũ, đặt mặc định mới.
 *
 * Params:
 * - id: _id của Address cần đặt làm mặc định.
 *
 * Không cần request body.
 *
 * Response 200: Địa chỉ đã được đặt làm mặc định.
 * Response 400: Address ID không hợp lệ.
 * Response 401: Chưa đăng nhập.
 * Response 403: Không phải CUSTOMER.
 * Response 404: Không tìm thấy địa chỉ.
 *
 * Endpoint riêng để tách biệt nghiệp vụ khỏi PUT cập nhật thông thường.
 * Đảm bảo isDefault không bao giờ được thay đổi qua PUT.
 */
router.patch(
  "/:id/default",
  authMiddleware,
  authorizeRoles(ROLES.CUSTOMER),
  addressController.setDefaultAddress
);

/**
 * Bước 10: API xóa địa chỉ.
 *
 * DELETE /api/addresses/:id
 *
 * Middleware chain:
 * 1. authMiddleware: Xác thực JWT.
 * 2. authorizeRoles(CUSTOMER): Chỉ CUSTOMER được xóa.
 * 3. addressController.deleteAddress: Xóa địa chỉ, xử lý chuyển mặc định.
 *
 * Params:
 * - id: _id của Address cần xóa.
 *
 * Không cần request body.
 *
 * Response 200: Xóa thành công.
 * Response 400: Address ID không hợp lệ.
 * Response 401: Chưa đăng nhập.
 * Response 403: Không phải CUSTOMER.
 * Response 404: Không tìm thấy địa chỉ.
 */
router.delete(
  "/:id",
  authMiddleware,
  authorizeRoles(ROLES.CUSTOMER),
  addressController.deleteAddress
);

// Bước 11: Export Router.
module.exports = router;
