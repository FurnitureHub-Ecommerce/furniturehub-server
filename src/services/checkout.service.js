/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Kiểm tra địa chỉ và giỏ hàng trước khi Customer tiếp tục checkout.
 *
 * Bước 1: Tái sử dụng Address Service và Cart Repository hiện có.
 * Bước 2: Thu thập lỗi số lượng, biến thể và sản phẩm theo từng CartItem.
 * Bước 3: Kiểm tra địa chỉ thuộc Customer và đọc Cart theo userId từ JWT.
 * Bước 4: Trả kết quả hợp lệ hoặc danh sách lỗi, không ghi dữ liệu.
 */

const addressService = require("./address.service");
const cartRepository = require("../repositories/cart.repository");

/**
 * Mục đích: trả tất cả lỗi nghiệp vụ của một CartItem đã populate.
 * Đầu vào: item chứa quantity, variantId và variantId.productId.
 * Bước 1: Giữ itemId để frontend nhận diện dòng lỗi, kể cả khi Variant bị xóa.
 * Bước 2: Kiểm tra quantity là số nguyên >= 1, không ép kiểu hay sửa số lượng.
 * Bước 3: Kiểm tra Variant tồn tại và isActive đúng bằng true.
 * Bước 4: Nếu có Variant, kiểm tra Product tồn tại và isActive bằng true.
 * Populate trả null khi tham chiếu bị thiếu, sai định dạng hoặc đã bị xóa.
 * Khi thiếu Variant, không thể kiểm tra Product nên chỉ trả lỗi tham chiếu.
 * Một item có thể có nhiều lỗi; mọi lỗi đều giữ mã và thông báo ổn định.
 * Hàm không so sánh giá, truy vấn tồn kho hoặc thay đổi item đầu vào.
 */
const getItemErrors = (item) => {
  const errors = [];
  const variant = item?.variantId;
  const identity = {
    itemId: item?._id?.toString() || null,
    variantId: variant?._id?.toString() || null,
  };

  if (!Number.isInteger(item?.quantity) || item.quantity < 1) {
    errors.push({
      ...identity,
      code: "INVALID_QUANTITY",
      message: "Quantity must be an integer greater than or equal to 1",
    });
  }

  if (!variant) {
    errors.push({
      ...identity,
      code: "VARIANT_NOT_FOUND",
      message: "Product variant not found",
    });
    return errors;
  }

  if (variant.isActive !== true) {
    errors.push({
      ...identity,
      code: "VARIANT_INACTIVE",
      message: "Product variant is no longer available for sale",
    });
  }

  const product = variant.productId;
  if (!product) {
    errors.push({
      ...identity,
      code: "PRODUCT_NOT_FOUND",
      message: "Product not found",
    });
  } else if (product.isActive !== true) {
    errors.push({
      ...identity,
      code: "PRODUCT_INACTIVE",
      message: "Product is no longer available for sale",
    });
  }

  return errors;
};

/**
 * Đầu vào: userId từ JWT đã xác thực, addressId từ body đã qua Zod.
 * Bước 1: Dùng getAddressById để kiểm tra ObjectId và truy vấn cả _id, userId.
 * Địa chỉ không tồn tại hoặc của người khác cùng trả lỗi 404, không lộ dữ liệu.
 * Bước 2: Đọc Cart với tùy chọn lean để giữ nguyên kiểu dữ liệu đã lưu.
 * Không gọi getCart vì hàm đó tính tiền; không gọi findOrCreate vì có ghi dữ liệu.
 * Bước 3: Cart chưa tồn tại hoặc không có item trả valid=false (HTTP 400).
 * Bước 4: Duyệt toàn bộ item và gom lỗi; có bất kỳ lỗi nào thì không thành công.
 * Lỗi truy vấn được chuyển lên Controller để trả thông báo hệ thống chung.
 * Kết quả chỉ phản ánh thời điểm đọc, không giữ hàng hay bảo đảm giá/tồn kho.
 * Task 4 phải kiểm tra lại điều kiện khi tạo đơn; Task 3 phụ trách tồn kho và giá.
 */
const validateCheckout = async (userId, addressId) => {
  await addressService.getAddressById(userId, addressId);

  const cart = await cartRepository.findByUserId(userId, { lean: true });
  if (!cart) {
    return { message: "Cart not found", valid: false };
  }

  if (!Array.isArray(cart.items) || cart.items.length === 0) {
    return { message: "Cart is empty", valid: false };
  }

  const errors = cart.items.flatMap(getItemErrors);
  if (errors.length > 0) {
    return { message: "Cart is invalid for checkout", valid: false, errors };
  }

  return { message: "Cart is valid for checkout", valid: true };
};

module.exports = { validateCheckout };
