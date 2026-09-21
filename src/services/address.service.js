/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Xử lý toàn bộ nghiệp vụ quản lý địa chỉ giao hàng của Customer.
 *
 * Bước 1: Import Mongoose và Address Repository.
 * Bước 2: Tạo hàm xử lý lỗi nghiệp vụ.
 * Bước 3: Kiểm tra Address ID hợp lệ.
 * Bước 4: Lấy danh sách địa chỉ của Customer.
 * Bước 5: Lấy chi tiết một địa chỉ.
 * Bước 6: Tạo địa chỉ mới.
 * Bước 7: Cập nhật địa chỉ.
 * Bước 8: Đặt địa chỉ làm mặc định.
 * Bước 9: Xóa địa chỉ.
 * Bước 10: Export các hàm cho Controller.
 *
 * Lưu ý quan trọng:
 * - userId luôn được lấy từ JWT (req.user.userId), không từ request body.
 * - Mọi truy vấn đều lọc theo userId để đảm bảo Customer
 *   chỉ thao tác được địa chỉ của chính mình.
 * - isDefault không được cập nhật qua PUT /api/addresses/:id.
 *   Sử dụng PATCH /api/addresses/:id/default để quản lý riêng.
 */

const mongoose = require("mongoose");

const addressRepository = require("../repositories/address.repository");

/**
 * Bước 2: Tạo lỗi nghiệp vụ.
 *
 * - Nhận thông báo lỗi và HTTP status code.
 * - Tạo đối tượng Error chuẩn JavaScript.
 * - Gắn statusCode để Controller đọc và trả đúng HTTP code.
 * - Trả về đối tượng lỗi cho hàm gọi ném (throw).
 */
const makeError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

/**
 * Bước 3: Kiểm tra Address ID hợp lệ.
 *
 * - Nhận ID cần kiểm tra.
 * - Kiểm tra định dạng ObjectId 24 ký tự hex của MongoDB.
 * - Nếu không hợp lệ, ném lỗi 400 thay vì để Mongoose phát sinh CastError.
 * - CastError từ Mongoose khó xử lý hơn và có thể lộ thông tin nội bộ.
 *
 * Ví dụ ID không hợp lệ: "abc", "123", "invalid-id".
 * Ví dụ ID hợp lệ: "507f1f77bcf86cd799439011".
 */
const validateObjectId = (id) => {
  if (
    typeof id !== "string" ||
    !mongoose.isObjectIdOrHexString(id)
  ) {
    throw makeError("Address ID không hợp lệ", 400);
  }
};

/**
 * Bước 4: Lấy danh sách địa chỉ của Customer.
 *
 * Input:
 * - userId: ID của CUSTOMER lấy từ JWT.
 *
 * Output:
 * - Danh sách địa chỉ của Customer, sắp xếp: mặc định trước.
 * - Mảng rỗng nếu Customer chưa có địa chỉ nào.
 *
 * Luồng xử lý:
 * 1. Gọi Repository tìm tất cả địa chỉ theo userId.
 * 2. Trả về danh sách (có thể rỗng).
 *
 * Customer chỉ thấy địa chỉ của chính mình vì Repository lọc theo userId từ JWT.
 */
const getMyAddresses = async (userId) => {
  // Gọi Repository lấy tất cả địa chỉ thuộc về Customer.
  return addressRepository.findByUserId(userId);
};

/**
 * Bước 5: Lấy chi tiết một địa chỉ.
 *
 * Input:
 * - userId: ID của CUSTOMER lấy từ JWT.
 * - addressId: ID của địa chỉ cần xem.
 *
 * Output:
 * - Document địa chỉ nếu tìm thấy và thuộc về Customer.
 *
 * Luồng xử lý:
 * 1. Kiểm tra addressId hợp lệ.
 * 2. Tìm địa chỉ theo cả addressId VÀ userId.
 * 3. Nếu không tìm thấy (không tồn tại hoặc không phải chủ sở hữu), trả lỗi 404.
 *    Cố tình trả 404 thay vì 403 để tránh tiết lộ địa chỉ của Customer khác tồn tại.
 *
 * Các lỗi nghiệp vụ:
 * - addressId không hợp lệ: 400.
 * - Địa chỉ không tồn tại hoặc không thuộc Customer hiện tại: 404.
 */
const getAddressById = async (userId, addressId) => {
  // Bước 1: Kiểm tra định dạng ID trước khi truy vấn database.
  validateObjectId(addressId);

  // Bước 2: Tìm địa chỉ, đồng thời xác nhận quyền sở hữu.
  const address = await addressRepository.findByIdAndUserId(
    addressId,
    userId
  );

  // Bước 3: Địa chỉ không tồn tại hoặc không thuộc Customer.
  // Trả 404 để không tiết lộ sự tồn tại của địa chỉ thuộc Customer khác.
  if (!address) {
    throw makeError("Không tìm thấy địa chỉ", 404);
  }

  return address;
};

/**
 * Bước 6: Tạo địa chỉ mới cho Customer.
 *
 * Input:
 * - userId: ID của CUSTOMER lấy từ JWT.
 * - data: Dữ liệu địa chỉ đã qua Validator (receiverName, phone, addressLine, ward, city).
 *
 * Output:
 * - Document địa chỉ vừa tạo.
 *
 * Luồng xử lý:
 * 1. Đếm số địa chỉ hiện có của Customer.
 * 2. Nếu đây là địa chỉ đầu tiên, tự động đặt isDefault = true.
 *    Nếu đã có địa chỉ khác, isDefault = false.
 * 3. Tạo địa chỉ mới trong database với userId lấy từ JWT.
 * 4. Trả về địa chỉ vừa tạo.
 *
 * Quy tắc nghiệp vụ:
 * - userId luôn gắn từ JWT, không từ body.
 * - isDefault do Service quyết định, không nhận từ client.
 * - Địa chỉ đầu tiên tự động là mặc định (BR03).
 */
const createAddress = async (userId, data) => {
  // Bước 1: Đếm số địa chỉ hiện có của Customer.
  const addressCount = await addressRepository.countByUserId(userId);

  /*
   * Bước 2: Xác định isDefault.
   *
   * Nếu đây là địa chỉ đầu tiên (count = 0), đặt làm mặc định.
   * Các địa chỉ tiếp theo mặc định là false.
   * Khách hàng có thể đổi mặc định qua PATCH /:id/default.
   */
  const isDefault = addressCount === 0;

  // Bước 3: Tạo địa chỉ mới, gắn userId từ JWT và isDefault do Service quyết định.
  const address = await addressRepository.create({
    userId,
    ...data,
    isDefault,
  });

  return address;
};

/**
 * Bước 7: Cập nhật thông tin địa chỉ (cập nhật toàn phần).
 *
 * Input:
 * - userId: ID của CUSTOMER lấy từ JWT.
 * - addressId: ID của địa chỉ cần cập nhật.
 * - data: Dữ liệu mới đã qua Validator (receiverName, phone, addressLine, ward, city).
 *
 * Output:
 * - Document địa chỉ sau khi cập nhật.
 *
 * Luồng xử lý:
 * 1. Kiểm tra addressId hợp lệ.
 * 2. Tìm địa chỉ và xác nhận quyền sở hữu.
 * 3. Cập nhật các trường được phép (không cập nhật userId, isDefault, _id).
 * 4. Lưu và trả về địa chỉ sau khi cập nhật.
 *
 * Quy tắc PUT (full update):
 * - Client phải gửi đầy đủ các trường cần thiết.
 * - Validator đã đảm bảo không nhận userId hoặc isDefault từ client.
 * - isDefault KHÔNG bị thay đổi qua endpoint này.
 *
 * Các lỗi nghiệp vụ:
 * - addressId không hợp lệ: 400.
 * - Địa chỉ không tồn tại hoặc không thuộc Customer: 404.
 */
const updateAddress = async (userId, addressId, data) => {
  // Bước 1: Kiểm tra định dạng ID.
  validateObjectId(addressId);

  // Bước 2: Tìm địa chỉ và xác nhận quyền sở hữu.
  const address = await addressRepository.findByIdAndUserId(
    addressId,
    userId
  );

  // Không tìm thấy hoặc không phải chủ sở hữu.
  if (!address) {
    throw makeError("Không tìm thấy địa chỉ", 404);
  }

  /*
   * Bước 3: Cập nhật các trường được phép.
   *
   * Chỉ cập nhật 5 trường: receiverName, phone, addressLine, ward, city.
   * isDefault KHÔNG thay đổi qua PUT này.
   * userId, _id, createdAt, updatedAt do Mongoose tự quản lý.
   *
   * Gán trực tiếp từng trường thay vì Object.assign() để rõ ràng hơn
   * và tránh vô tình gán các trường không mong muốn.
   */
  address.receiverName = data.receiverName;
  address.phone = data.phone;
  address.addressLine = data.addressLine;
  address.ward = data.ward;
  address.city = data.city;

  // Bước 4: Lưu và trả về địa chỉ đã cập nhật.
  return addressRepository.save(address);
};

/**
 * Bước 8: Đặt địa chỉ làm mặc định.
 *
 * Input:
 * - userId: ID của CUSTOMER lấy từ JWT.
 * - addressId: ID của địa chỉ cần đặt làm mặc định.
 *
 * Output:
 * - Document địa chỉ đã được đặt làm mặc định.
 *
 * Luồng xử lý:
 * 1. Kiểm tra addressId hợp lệ.
 * 2. Tìm địa chỉ và xác nhận quyền sở hữu.
 * 3. Kiểm tra địa chỉ chưa phải mặc định (tránh thao tác dư thừa).
 * 4. Bỏ mặc định tất cả địa chỉ hiện tại của Customer.
 * 5. Đặt địa chỉ mới làm mặc định.
 * 6. Lưu và trả về địa chỉ mới.
 *
 * Quy tắc nghiệp vụ:
 * - Mỗi Customer chỉ có tối đa một địa chỉ mặc định.
 * - Khi đặt địa chỉ B làm mặc định, địa chỉ A trước đó bị bỏ mặc định.
 * - Chỉ có thể đặt địa chỉ thuộc về Customer hiện tại.
 *
 * Lưu ý về tính nhất quán:
 * Không dùng transaction vì môi trường MongoDB local đơn lẻ
 * thường không cấu hình replica set (cần thiết cho session transaction).
 * Giải pháp: clearDefaultByUserId() → save(address).
 * Khoảng thời gian giữa hai bước rất ngắn và chấp nhận được
 * trong phạm vi SDN302 (không cần high availability).
 *
 * Các lỗi nghiệp vụ:
 * - addressId không hợp lệ: 400.
 * - Địa chỉ không tồn tại hoặc không thuộc Customer: 404.
 */
const setDefaultAddress = async (userId, addressId) => {
  // Bước 1: Kiểm tra định dạng ID.
  validateObjectId(addressId);

  // Bước 2: Tìm địa chỉ và xác nhận quyền sở hữu.
  const address = await addressRepository.findByIdAndUserId(
    addressId,
    userId
  );

  // Không tìm thấy hoặc không phải chủ sở hữu.
  if (!address) {
    throw makeError("Không tìm thấy địa chỉ", 404);
  }

  // Bước 3: Nếu địa chỉ đã là mặc định, không cần thay đổi.
  // Trả về ngay để tránh thao tác database dư thừa.
  if (address.isDefault) {
    return address;
  }

  /*
   * Bước 4: Bỏ mặc định tất cả địa chỉ hiện tại.
   *
   * Dùng updateMany để đảm bảo không còn địa chỉ nào isDefault = true.
   * Thao tác này cần được thực hiện TRƯỚC khi đặt địa chỉ mới làm mặc định.
   */
  await addressRepository.clearDefaultByUserId(userId);

  // Bước 5: Đặt địa chỉ mới làm mặc định.
  address.isDefault = true;

  // Bước 6: Lưu và trả về.
  return addressRepository.save(address);
};

/**
 * Bước 9: Xóa địa chỉ.
 *
 * Input:
 * - userId: ID của CUSTOMER lấy từ JWT.
 * - addressId: ID của địa chỉ cần xóa.
 *
 * Output:
 * - Không trả về dữ liệu (void).
 *
 * Luồng xử lý:
 * 1. Kiểm tra addressId hợp lệ.
 * 2. Tìm và xóa địa chỉ, xác nhận quyền sở hữu.
 * 3. Nếu không tìm thấy, trả lỗi 404.
 * 4. Nếu địa chỉ vừa xóa là mặc định và còn địa chỉ khác,
 *    tự động chọn địa chỉ cũ nhất còn lại làm mặc định.
 * 5. Nếu xóa địa chỉ cuối cùng, Customer không còn địa chỉ mặc định.
 *
 * Quy tắc nghiệp vụ (BR05):
 * - Customer có thể xóa bất kỳ địa chỉ nào của mình.
 * - Xóa địa chỉ mặc định → tự động chuyển mặc định sang địa chỉ cũ nhất còn lại.
 * - Xóa địa chỉ cuối cùng → không còn địa chỉ mặc định, không lỗi.
 * - Xóa địa chỉ đã lưu không ảnh hưởng đến snapshot địa chỉ trong Order.
 *
 * Các lỗi nghiệp vụ:
 * - addressId không hợp lệ: 400.
 * - Địa chỉ không tồn tại hoặc không thuộc Customer: 404.
 */
const deleteAddress = async (userId, addressId) => {
  // Bước 1: Kiểm tra định dạng ID.
  validateObjectId(addressId);

  // Bước 2: Tìm và xóa địa chỉ, đồng thời xác nhận quyền sở hữu.
  const deletedAddress = await addressRepository.deleteByIdAndUserId(
    addressId,
    userId
  );

  // Bước 3: Không tìm thấy địa chỉ hoặc không phải chủ sở hữu.
  if (!deletedAddress) {
    throw makeError("Không tìm thấy địa chỉ", 404);
  }

  /*
   * Bước 4: Xử lý khi xóa địa chỉ mặc định.
   *
   * Kiểm tra địa chỉ vừa xóa có phải mặc định không.
   * Nếu có, cần tự động chọn địa chỉ khác làm mặc định.
   */
  if (deletedAddress.isDefault) {
    /*
     * Tìm địa chỉ cũ nhất còn lại sau khi đã xóa.
     * excludeId để loại trừ document vừa bị xóa (dù đã xóa, truyền vào để an toàn).
     *
     * Nếu không còn địa chỉ nào (vừa xóa địa chỉ cuối cùng),
     * findOldestByUserId trả về null và không có gì cần làm thêm.
     */
    const nextDefault = await addressRepository.findOldestByUserId(
      userId,
      addressId
    );

    // Nếu còn địa chỉ khác, đặt làm mặc định.
    if (nextDefault) {
      nextDefault.isDefault = true;
      await addressRepository.save(nextDefault);
    }
  }

  // Bước 5: Không trả dữ liệu địa chỉ đã xóa.
  // Controller sẽ trả HTTP 200 với thông báo thành công.
};

// Bước 10: Export các hàm cho Controller.
module.exports = {
  getMyAddresses,
  getAddressById,
  createAddress,
  updateAddress,
  setDefaultAddress,
  deleteAddress,
};
