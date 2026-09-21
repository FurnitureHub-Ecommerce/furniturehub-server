/**
 * @Author: Minh Truong
 * Mục đích: tạo và đọc đơn của Customer bằng snapshot tại thời điểm đặt hàng.
 * Tái sử dụng Address Service, Cart Repository và kiểm tra Checkout/Task 3.
 * Chỉ ghi một document Order chứa đầy đủ items để không cần transaction nhiều document.
 */
const Order = require("../models/Order.model");
const addressService = require("./address.service");
const cartRepository = require("../repositories/cart.repository");
const checkoutService = require("./checkout.service");
const { orderIdSchema } = require("../validators/order.validator");

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

module.exports = { createOrder, getOrderById };
