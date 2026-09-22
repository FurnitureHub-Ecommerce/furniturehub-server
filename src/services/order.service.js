/**
 * @Author: Minh Truong
 * Mục đích: tạo, đọc đơn của Customer và kiểm soát yêu cầu đổi trạng thái.
 * Tái sử dụng Address Service, Cart Repository và kiểm tra Checkout/Task 3.
 * Chỉ ghi một document Order chứa đầy đủ items để không cần transaction nhiều document.
 */
const Order = require("../models/Order.model");
const addressService = require("./address.service");
const cartRepository = require("../repositories/cart.repository");
const checkoutService = require("./checkout.service");
const { orderIdSchema } = require("../validators/order.validator");
const { ORDER_STATUSES, ORDER_STATUS_TRANSITIONS } = require("../constants/orderStatus");

/**
 * Đầu vào: userId từ JWT và addressId đã qua Zod.
 * Bước 1: Đọc Address theo _id/userId; địa chỉ thiếu hoặc của người khác trả 404.
 * Bước 2: Đọc Cart của Customer theo userId, populate Variant/Product và giữ kiểu gốc.
 * Bước 3: Dùng validateCart kiểm tra toàn bộ dòng, tổng quantity theo Variant,
 * Inventory.quantity và ProductVariant.price mới nhất tại lần đọc này.
 * Cart, số lượng, trạng thái, giá hoặc tồn kho lỗi trả 400 giống Checkout;
 * kết quả chẩn đoán có itemId/variantId và totalAmount=null, không tạo đơn một phần.
 * Bước 4: Sao chép năm trường địa chỉ và mỗi dòng giá đã tính, không dùng giá Cart.
 * Lưu thêm tên/SKU/thuộc tính để vẫn xem được sau khi Product/Variant bị sửa hoặc xóa.
 * Bước 5: Validate và lưu Order với status pending cùng mọi item trong một insert.
 * Chờ xác nhận ghi majority trước khi trả document đã lưu; lỗi ghi chuyển thành 500.
 * Mất kết nối lúc chờ xác nhận có thể đã lưu đủ đơn: không tự ghi lại hoặc xóa bù.
 * Không xóa Cart, trừ/giữ Inventory hoặc tạo Payment; không chống gửi trùng request.
 * Kiểm tra tồn kho không ngăn overselling vì không có nghiệp vụ giữ hàng.
 */
const createOrder = async (userId, addressId) => {
  const address = await addressService.getAddressById(userId, addressId);
  const cart = await cartRepository.findByUserId(userId, { lean: true });
  const result = await checkoutService.validateCart(cart);
  if (!result.valid) {
    const error = new Error(result.message);
    error.statusCode = 400;
    error.details = result;
    throw error;
  }

  const order = new Order({
    userId,
    status: "pending",
    shippingAddress: {
      receiverName: address.receiverName,
      phone: address.phone,
      addressLine: address.addressLine,
      ward: address.ward,
      city: address.city,
    },
    items: result.items.map((item, index) => {
      const variant = cart.items[index].variantId;
      return {
        variantId: item.variantId,
        productName: variant.productId.name,
        sku: variant.sku,
        color: variant.color,
        size: variant.size,
        material: variant.material,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        itemSubtotal: item.itemSubtotal,
      };
    }),
    subtotal: result.totalAmount,
    totalAmount: result.totalAmount,
  });

  await order.save({ writeConcern: { w: "majority" } });
  return order.toObject({ versionKey: false });
};

/**
 * Đầu vào: userId từ JWT và orderId từ URL, không dùng userId từ body/query.
 * Bước 1: Validate ID bằng Zod, sai định dạng trả 400 trước truy vấn.
 * Bước 2: Query cả _id và userId; không tìm thấy hoặc khác chủ đều trả 404.
 * Bước 3: Trả document đã lưu gồm địa chỉ, items, giá/tổng tiền và timestamps.
 * Không populate Address/ProductVariant/User hoặc tính lại tiền của đơn cũ.
 * Vì item nằm trong Order, một query đọc đầy đủ lịch sử kể cả tham chiếu đã bị xóa.
 * Lỗi database chuyển lên Controller trả 500, không lộ chi tiết nội bộ.
 */
const getOrderById = async (userId, orderId) => {
  if (!orderIdSchema.safeParse(orderId).success) {
    const error = new Error("Invalid order ID");
    error.statusCode = 400;
    throw error;
  }

  const order = await Order.findOne({ _id: orderId, userId }).select("-__v").lean();
  if (!order) {
    const error = new Error("Order not found");
    error.statusCode = 404;
    throw error;
  }
  return order;
};

/**
 * Kiểm tra quy tắc chuyển trạng thái tập trung để Task 2 và Task 3 tái sử dụng.
 * Bước 1: Từ chối trạng thái đích ngoài enum bằng 400, kể cả khi gọi Service trực tiếp.
 * Bước 2: Cùng trạng thái trả 409; không coi yêu cầu lặp là cập nhật thành công.
 * Bước 3: Chỉ chấp nhận pending sang confirmed/rejected/cancelled theo bảng quy tắc.
 * Trạng thái nguồn lạ hoặc mọi đường chuyển khác đều trả 409.
 * Hàm này chỉ kiểm tra quy tắc, không cấp phép bỏ qua nghiệp vụ hoặc ghi database.
 */
const assertOrderStatusTransition = (currentStatus, nextStatus) => {
  if (!ORDER_STATUSES.includes(nextStatus)) {
    const error = new Error("Invalid order status");
    error.statusCode = 400;
    throw error;
  }

  if (currentStatus === nextStatus) {
    const error = new Error(`Order already has status "${currentStatus}"`);
    error.statusCode = 409;
    throw error;
  }

  if (
    !ORDER_STATUSES.includes(currentStatus) ||
    !ORDER_STATUS_TRANSITIONS[currentStatus].includes(nextStatus)
  ) {
    const error = new Error(`Cannot change order status from "${currentStatus}" to "${nextStatus}"`);
    error.statusCode = 409;
    throw error;
  }
};

/**
 * Tiếp nhận yêu cầu cập nhật từ STAFF/ADMIN đã được Route phân quyền.
 * Bước 1: Kiểm tra ID và status trước truy vấn, kể cả khi gọi Service trực tiếp.
 * Bước 2: Tìm Order theo ID; nhân viên không bị giới hạn bởi chủ đơn. Thiếu trả 404.
 * Bước 3: Kiểm tra trạng thái lặp và bảng quy tắc qua hàm dùng chung.
 * Bước 4: Chặn bằng 409 vì chưa có Confirm/Reject (Task 2), Cancel (Task 3)
 * hoặc xử lý kho (Task 4). Đổi enum đơn thuần không hoàn thành các nghiệp vụ này.
 *
 * Task 1 không có đường ghi: hai yêu cầu đồng thời đều bị chặn, không ghi đè nhau.
 * Khi bổ sung nghiệp vụ, phải cập nhật có điều kiện {_id: orderId, status: order.status}
 * bằng findOneAndUpdate với runValidators và trả 409 nếu không còn khớp.
 * Việc ghi Order và thay đổi kho phải cùng được bảo đảm nhất quán trong nghiệp vụ;
 * không thay lỗi bên dưới bằng một lệnh save chỉ đổi status hoặc cờ bỏ qua kiểm tra.
 */
const updateOrderStatus = async (orderId, status) => {
  if (!orderIdSchema.safeParse(orderId).success) {
    const error = new Error("Invalid order ID");
    error.statusCode = 400;
    throw error;
  }
  if (!ORDER_STATUSES.includes(status)) {
    const error = new Error("Invalid order status");
    error.statusCode = 400;
    throw error;
  }

  const order = await Order.findById(orderId).select("_id status").lean();
  if (!order) {
    const error = new Error("Order not found");
    error.statusCode = 404;
    throw error;
  }

  assertOrderStatusTransition(order.status, status);

  const error = new Error(
    `Order status transition to "${status}" is not available until the corresponding order workflow is implemented`
  );
  error.statusCode = 409;
  throw error;
};

module.exports = { createOrder, getOrderById, assertOrderStatusTransition, updateOrderStatus };
