/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Kiểm tra dữ liệu đầu vào cho Address API.
 *
 * Bước 1: Import Zod.
 * Bước 2: Định nghĩa schema cho request tạo địa chỉ mới.
 * Bước 3: Định nghĩa schema cho request cập nhật địa chỉ.
 * Bước 4: Export các schema cho Route sử dụng.
 *
 * Lưu ý quan trọng:
 * - userId KHÔNG được nhận từ request body.
 *   userId phải lấy từ JWT (req.user.userId) để tránh thao tác địa chỉ của người khác.
 * - isDefault KHÔNG được nhận từ body khi tạo hoặc cập nhật.
 *   Trạng thái mặc định được quản lý riêng qua PATCH /:id/default.
 * - _id, createdAt, updatedAt do Mongoose tự quản lý, không nhận từ client.
 * - Định dạng số điện thoại Việt Nam được kiểm tra bằng regex.
 */

const { z } = require("zod");

/**
 * Bước 2: Schema tạo địa chỉ mới (POST /api/addresses).
 *
 * Client phải gửi đủ 5 trường bắt buộc:
 * - receiverName: Tên người nhận hàng, không chỉ là khoảng trắng.
 * - phone: Số điện thoại Việt Nam hợp lệ.
 * - addressLine: Địa chỉ cụ thể (số nhà, đường, khu vực).
 * - ward: Phường/xã.
 * - city: Tỉnh/thành phố.
 *
 * Không được gửi thêm các trường không hỗ trợ (userId, isDefault, _id...).
 * Validator dùng .strict() để từ chối mọi trường không khai báo.
 *
 * Regex số điện thoại Việt Nam:
 * - Bắt đầu bằng 0 hoặc +84.
 * - Tiếp theo là 9 chữ số (với 0) hoặc 9 chữ số (với +84).
 * - Tổng cộng 10 chữ số (với đầu số 0) hoặc 11-12 ký tự (với +84).
 * - Ví dụ hợp lệ: 0912345678, +84912345678.
 */
const createAddressSchema = z
  .object({
    receiverName: z
      .string({
        error: "Tên người nhận phải là chuỗi ký tự",
      })
      /*
       * Kiểm tra không chỉ chứa khoảng trắng.
       * trim() trong Mongoose sẽ xử lý khoảng trắng thừa,
       * nhưng Validator cần đảm bảo trường không rỗng sau khi trim.
       */
      .trim()
      .min(1, {
        message: "Tên người nhận không được để trống",
      }),

    phone: z
      .string({
        error: "Số điện thoại phải là chuỗi ký tự",
      })
      /*
       * Kiểm tra định dạng số điện thoại Việt Nam.
       * Chấp nhận: 0912345678, 0312345678, +84912345678.
       * Không chấp nhận: 123456789, 091234567 (thiếu chữ số).
       */
      .regex(/^(0|\+84)(3|5|7|8|9)\d{8}$/, {
        message:
          "Số điện thoại không đúng định dạng Việt Nam (ví dụ: 0912345678 hoặc +84912345678)",
      }),

    addressLine: z
      .string({
        error: "Địa chỉ chi tiết phải là chuỗi ký tự",
      })
      .trim()
      .min(1, {
        message: "Địa chỉ chi tiết không được để trống",
      }),

    ward: z
      .string({
        error: "Phường/xã phải là chuỗi ký tự",
      })
      .trim()
      .min(1, {
        message: "Phường/xã không được để trống",
      }),

    city: z
      .string({
        error: "Tỉnh/thành phố phải là chuỗi ký tự",
      })
      .trim()
      .min(1, {
        message: "Tỉnh/thành phố không được để trống",
      }),
  })
  /*
   * .strict() từ chối mọi trường không khai báo trong schema.
   * Đảm bảo client không gửi userId, isDefault, _id, createdAt, updatedAt.
   * Nếu client gửi trường lạ, Validator trả lỗi 400.
   */
  .strict();

/**
 * Bước 3: Schema cập nhật địa chỉ (PUT /api/addresses/:id).
 *
 * Áp dụng quy tắc cập nhật toàn phần (full update):
 * Client phải gửi đủ các trường cần thiết.
 * Không cho phép gửi thiếu trường để tránh xóa dữ liệu ngoài ý muốn.
 *
 * Các trường được phép cập nhật:
 * - receiverName, phone, addressLine, ward, city.
 *
 * Các trường bị chặn hoàn toàn:
 * - userId: Không cho phép thay đổi chủ sở hữu địa chỉ.
 * - isDefault: Sử dụng PATCH /:id/default để thay đổi địa chỉ mặc định.
 * - _id, createdAt, updatedAt: Do hệ thống quản lý.
 *
 * Dùng lại các rule validation giống createAddressSchema.
 */
const updateAddressSchema = z
  .object({
    receiverName: z
      .string({
        error: "Tên người nhận phải là chuỗi ký tự",
      })
      .trim()
      .min(1, {
        message: "Tên người nhận không được để trống",
      }),

    phone: z
      .string({
        error: "Số điện thoại phải là chuỗi ký tự",
      })
      .regex(/^(0|\+84)(3|5|7|8|9)\d{8}$/, {
        message:
          "Số điện thoại không đúng định dạng Việt Nam (ví dụ: 0912345678 hoặc +84912345678)",
      }),

    addressLine: z
      .string({
        error: "Địa chỉ chi tiết phải là chuỗi ký tự",
      })
      .trim()
      .min(1, {
        message: "Địa chỉ chi tiết không được để trống",
      }),

    ward: z
      .string({
        error: "Phường/xã phải là chuỗi ký tự",
      })
      .trim()
      .min(1, {
        message: "Phường/xã không được để trống",
      }),

    city: z
      .string({
        error: "Tỉnh/thành phố phải là chuỗi ký tự",
      })
      .trim()
      .min(1, {
        message: "Tỉnh/thành phố không được để trống",
      }),
  })
  /*
   * .strict() đảm bảo client không gửi userId, isDefault hoặc các trường khác
   * không thuộc danh sách được phép cập nhật.
   */
  .strict();

// Bước 4: Export các schema cho Route sử dụng.
module.exports = {
  createAddressSchema,
  updateAddressSchema,
};
