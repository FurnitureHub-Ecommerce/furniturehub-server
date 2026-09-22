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
const inventoryRepository = require("../repositories/inventory.repository");
const { orderIdSchema } = require("../validators/order.validator");
const { ORDER_STATUSES, ORDER_STATUS_TRANSITIONS } = require("../constants/orderStatus");
const Payment = require("../models/Payment.model");
const ROLES = require("../constants/roles");

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
 * @Author: Minh Truong
 *
 * Mục đích:
 * Xử lý nghiệp vụ xác nhận đơn hàng (pending → confirmed) bởi STAFF hoặc ADMIN.
 *
 * Bước 1: Validate OrderId bằng Zod, sai định dạng trả 400 trước mọi truy vấn.
 * Bước 2: Tìm Order theo _id; nhân viên không bị giới hạn bởi chủ đơn.
 *         Order không tồn tại trả 404.
 * Bước 3: Kiểm tra quy tắc chuyển trạng thái qua assertOrderStatusTransition.
 *         Chỉ cho phép pending → confirmed. Mọi trường hợp khác trả 409.
 *         Tái sử dụng hàm dùng chung của Task 1, không viết lại logic quy tắc.
 * Bước 4: Gộp quantity các OrderItem theo variantId để kiểm tra tồn kho.
 *         Mỗi variant chỉ cần một bản ghi Inventory; gộp đúng trường hợp cùng variant.
 *         Đơn hàng pending chưa bao giờ trừ kho; confirm là thời điểm trừ kho duy nhất.
 * Bước 5: Gọi deductStockForOrder để kiểm tra và trừ kho atomic.
 *         Thiếu Inventory hoặc không đủ hàng trả 409, không cập nhật Order.
 *         Race condition được xử lý bởi điều kiện $gte trong bulkWrite.
 * Bước 6: Cập nhật Order bằng findOneAndUpdate với điều kiện { status: 'pending' }.
 *         Điều kiện này ngăn hai request đồng thời đều ghi thành công:
 *         - Nếu một request đã confirm, request kia không còn thấy status pending → trả null.
 *         - Trả null nghĩa là race condition, ném lỗi 409.
 *         new: true để trả document sau khi cập nhật.
 * Bước 7: Trả 200 với message và dữ liệu Order đã confirmed.
 *
 * QUAN TRỌNG VỀ NHẤT QUÁN DỮ LIỆU:
 * Nếu deductStock thành công nhưng findOneAndUpdate thất bại (race condition),
 * kho đã bị trừ nhưng Order vẫn pending. Đây là trường hợp tồn tại do không có
 * multi-document transaction trên môi trường standalone. Caller nhận 409 và có thể retry.
 * Không tự động rollback kho vì không có cơ chế an toàn không có transaction.
 * Tình huống này hiếm gặp: hai request confirm cùng lúc cho cùng một Order;
 * STAFF/ADMIN cần kiểm tra lại tồn kho nếu thấy 409 sau khi đã trừ một phần.
 */
const confirmOrder = async (orderId) => {
  // Bước 1: Validate ID.
  if (!orderIdSchema.safeParse(orderId).success) {
    const error = new Error("Invalid order ID");
    error.statusCode = 400;
    throw error;
  }

  // Bước 2: Tìm Order theo ID, không lọc theo userId vì STAFF/ADMIN quản lý mọi đơn.
  const order = await Order.findById(orderId).select("_id status items").lean();
  if (!order) {
    const error = new Error("Order not found");
    error.statusCode = 404;
    throw error;
  }

  // Bước 3: Kiểm tra quy tắc chuyển trạng thái bằng hàm dùng chung của Task 1.
  // Chỉ cho phép pending → confirmed; mọi trường hợp khác ném lỗi 409.
  assertOrderStatusTransition(order.status, "confirmed");

  // Bước 4: Gộp quantity theo variantId để kiểm tra và trừ đúng tổng số lượng.
  // Cùng variant xuất hiện nhiều dòng trong Order items → cộng dồn quantity.
  const deductionMap = new Map();
  for (const item of order.items) {
    const key = item.variantId.toString();
    deductionMap.set(key, (deductionMap.get(key) || 0) + item.quantity);
  }
  const deductions = Array.from(deductionMap.entries()).map(([variantId, quantity]) => ({
    variantId,
    quantity,
  }));

  // Bước 5: Kiểm tra và trừ kho atomic. Thiếu hàng ném lỗi 409.
  // Hàm này đọc tồn kho, kiểm tra trước, rồi bulkWrite có điều kiện $gte.
  await inventoryRepository.deductStockForOrder(deductions);

  // Bước 6: Cập nhật trạng thái Order với điều kiện status = pending.
  // Điều kiện này ngăn race condition với request reject hoặc confirm đồng thời.
  // Nếu trả null: request khác đã thay đổi status → 409.
  const updated = await Order.findOneAndUpdate(
    { _id: orderId, status: "pending" },
    { status: "confirmed" },
    { new: true, runValidators: true, select: "_id status updatedAt" }
  ).lean();

  if (!updated) {
    // Race condition: kho đã trừ nhưng Order không còn pending (bị Cancel hoặc Reject trước).
    // Tự động hoàn lại kho vừa trừ để bảo toàn tính nhất quán của Inventory.
    try {
      await inventoryRepository.restoreStockForOrder(deductions);
    } catch (restoreErr) {
      console.error("Failed to restore stock after confirm race condition:", restoreErr);
    }

    const error = new Error(
      "Order status has already been changed by another request"
    );
    error.statusCode = 409;
    throw error;
  }

  return updated;
};

/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Xử lý nghiệp vụ từ chối đơn hàng (pending → rejected) bởi STAFF hoặc ADMIN.
 *
 * Bước 1: Validate OrderId bằng Zod, sai định dạng trả 400.
 * Bước 2: Tìm Order theo _id; không lọc theo userId vì STAFF/ADMIN quản lý mọi đơn.
 *         Order không tồn tại trả 404.
 * Bước 3: Kiểm tra quy tắc chuyển trạng thái qua assertOrderStatusTransition.
 *         Chỉ cho phép pending → rejected. Mọi trường hợp khác trả 409.
 *         Không được từ chối đơn đã confirmed, rejected hoặc cancelled.
 * Bước 4: KHÔNG CẦN hoàn kho vì Order pending chưa bao giờ trừ kho.
 *         Tồn kho chỉ bị trừ khi confirm (bước 5 của confirmOrder).
 *         Từ chối trước khi confirm → không có gì để hoàn lại.
 * Bước 5: Cập nhật trạng thái bằng findOneAndUpdate với điều kiện { status: 'pending' }.
 *         Điều kiện này ngăn race condition với request confirm đồng thời:
 *         - Nếu một request confirm đã ghi trước → status không còn pending → trả null → 409.
 *         - Nếu hai request reject đồng thời → chỉ một thành công, một trả null → 409.
 * Bước 6: Trả 200 với message và dữ liệu Order đã rejected.
 *
 * Không xóa Order hoặc OrderItems. Không thêm rejectionReason vì schema không có trường này.
 */
const rejectOrder = async (orderId) => {
  // Bước 1: Validate ID.
  if (!orderIdSchema.safeParse(orderId).success) {
    const error = new Error("Invalid order ID");
    error.statusCode = 400;
    throw error;
  }

  // Bước 2: Tìm Order theo ID, không lọc theo userId vì STAFF/ADMIN quản lý mọi đơn.
  const order = await Order.findById(orderId).select("_id status").lean();
  if (!order) {
    const error = new Error("Order not found");
    error.statusCode = 404;
    throw error;
  }

  // Bước 3: Kiểm tra quy tắc chuyển trạng thái bằng hàm dùng chung của Task 1.
  // Chỉ cho phép pending → rejected; mọi trường hợp khác ném lỗi 409.
  assertOrderStatusTransition(order.status, "rejected");

  // Bước 4: Không hoàn kho vì pending chưa trừ kho lần nào.
  // Kho chỉ bị trừ khi STAFF/ADMIN xác nhận (confirmOrder).
  // Nếu tương lai thêm nghiệp vụ giữ hàng ở bước tạo đơn, phải cập nhật logic này.

  // Bước 5: Cập nhật trạng thái với điều kiện status = pending để xử lý concurrency.
  // Nếu trả null: request confirm hoặc reject khác đã chạy trước → 409.
  const updated = await Order.findOneAndUpdate(
    { _id: orderId, status: "pending" },
    { status: "rejected" },
    { new: true, runValidators: true, select: "_id status updatedAt" }
  ).lean();

  if (!updated) {
    const error = new Error(
      "Order status has already been changed by another request"
    );
    error.statusCode = 409;
    throw error;
  }

  return updated;
};

/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Xử lý nghiệp vụ hủy đơn hàng.
 *
 * Bước 1: Xác thực người dùng và validate Order ID bằng Zod.
 * Bước 2: Kiểm tra quyền hủy đơn hàng (CUSTOMER chỉ hủy đơn của mình, STAFF/ADMIN hủy đơn bất kỳ).
 * Bước 3: Kiểm tra trạng thái đơn hàng (chỉ pending được hủy; confirmed, rejected, cancelled bị chặn với 409).
 * Bước 4: Kiểm tra nghiệp vụ tồn kho (pending chưa trừ kho nên không hoàn kho để tránh tăng khống tồn kho).
 *         Kiểm tra thanh toán (nếu Payment đã 'paid', chặn với 409 do chưa có refund workflow).
 * Bước 5: Cập nhật trạng thái an toàn bằng atomic findOneAndUpdate với điều kiện status = 'pending'.
 * Bước 6: Trả về kết quả document Order đã cancelled.
 */
const cancelOrder = async (orderId, user) => {
  // Bước 1: Validate ID trước khi truy vấn database.
  if (!orderIdSchema.safeParse(orderId).success) {
    const error = new Error("Invalid order ID");
    error.statusCode = 400;
    throw error;
  }

  // Bước 2: Tìm Order theo ID để kiểm tra tồn tại.
  const order = await Order.findById(orderId).select("_id userId status items").lean();
  if (!order) {
    const error = new Error("Order not found");
    error.statusCode = 404;
    throw error;
  }

  // Kiểm tra quyền sở hữu: Customer chỉ được hủy đơn do chính mình tạo.
  // Không được hủy đơn của Customer khác (trả về 403 Forbidden).
  // STAFF và ADMIN có quyền hủy đơn trong phạm vi quản trị hệ thống.
  if (user && user.role === ROLES.CUSTOMER && order.userId.toString() !== user.userId.toString()) {
    const error = new Error("You do not have permission to cancel this order");
    error.statusCode = 403;
    throw error;
  }

  // Bước 3: Kiểm tra quy tắc chuyển trạng thái bằng assertOrderStatusTransition.
  // - Đơn đã cancelled: báo lỗi 409 (đã hủy trước đó).
  // - Đơn đã rejected: báo lỗi 409 (không thể hủy đơn bị từ chối).
  // - Đơn đã confirmed: báo lỗi 409 (chưa có quy trình hoàn kho và hoàn tiền Task 4).
  // - Chỉ pending được phép chuyển sang cancelled.
  assertOrderStatusTransition(order.status, "cancelled");

  // Bước 4: Kiểm tra các ràng buộc thanh toán và tồn kho.
  // - Tồn kho: Đơn pending chưa từng bị trừ kho khi tạo nên KHÔNG hoàn kho.
  // - Thanh toán: Nếu đơn đã có Payment và đã thanh toán ('paid'), chặn hủy với 409
  //   vì chưa có quy trình hoàn tiền (Refund API).
  const payment = await Payment.findOne({ orderId }).lean();
  if (payment && payment.status === "paid") {
    const error = new Error(
      "Cannot cancel order: payment has already been completed. Refund workflow is not implemented."
    );
    error.statusCode = 409;
    throw error;
  }

  // Bước 5: Cập nhật trạng thái Order atomic bằng findOneAndUpdate với điều kiện status = 'pending'.
  // Điều kiện này giải quyết triệt để race condition:
  // - Nếu 2 request Cancel đồng thời: chỉ request đầu tiên cập nhật thành công, request thứ hai trả null -> ném 409.
  // - Nếu 1 request Confirm và 1 request Cancel đồng thời: request nào cập nhật trước sẽ đổi status,
  //   request còn lại thấy status không còn là 'pending' -> trả null -> ném 409.
  const updated = await Order.findOneAndUpdate(
    { _id: orderId, status: "pending" },
    { status: "cancelled" },
    { new: true, runValidators: true, select: "_id status updatedAt" }
  ).lean();

  if (!updated) {
    const error = new Error(
      "Order status has already been changed by another request"
    );
    error.statusCode = 409;
    throw error;
  }

  // Nếu có Payment đang ở trạng thái 'pending', cập nhật Payment sang 'cancelled' để đồng bộ.
  if (payment && payment.status === "pending") {
    await Payment.updateOne(
      { orderId, status: "pending" },
      { status: "cancelled" }
    );
  }

  // Bước 6: Trả về kết quả Order đã cập nhật.
  return updated;
};

/**
 * Tiếp nhận yêu cầu cập nhật từ STAFF/ADMIN đã được Route phân quyền.
 * Bước 1: Kiểm tra ID và status trước truy vấn, kể cả khi gọi Service trực tiếp.
 * Bước 2: Tìm Order theo ID; nhân viên không bị giới hạn bởi chủ đơn. Thiếu trả 404.
 * Bước 3: Kiểm tra trạng thái lặp và bảng quy tắc qua hàm dùng chung.
 * Bước 4: Delegate sang confirmOrder, rejectOrder hoặc cancelOrder để thực hiện đầy đủ nghiệp vụ.
 *
 * Endpoint này không bỏ qua nghiệp vụ: Confirm đi qua confirmOrder (có trừ kho),
 * Reject đi qua rejectOrder (có kiểm tra kho), Cancel đi qua cancelOrder (có kiểm tra quyền và kho).
 */
const updateOrderStatus = async (orderId, status, user) => {
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

  // Delegate sang nghiệp vụ chuyên biệt thay vì chỉ kiểm tra quy tắc.
  // Confirm và Reject đã có đầy đủ nghiệp vụ sau Task 2.
  // Cancel đã có đầy đủ nghiệp vụ sau Task 3, không bỏ qua kiểm tra tồn kho và quyền.
  if (status === "confirmed") return confirmOrder(orderId);
  if (status === "rejected") return rejectOrder(orderId);
  if (status === "cancelled") return cancelOrder(orderId, user || { role: ROLES.STAFF });

  const order = await Order.findById(orderId).select("_id status").lean();
  if (!order) {
    const error = new Error("Order not found");
    error.statusCode = 404;
    throw error;
  }

  // Kiểm tra quy tắc trước khi báo chưa sẵn sàng, để trả 409 đúng lý do.
  assertOrderStatusTransition(order.status, status);

  const error = new Error(
    `Order status transition to "${status}" is not available until the corresponding order workflow is implemented`
  );
  error.statusCode = 409;
  throw error;
};

module.exports = {
  createOrder,
  getOrderById,
  assertOrderStatusTransition,
  confirmOrder,
  rejectOrder,
  cancelOrder,
  updateOrderStatus,
};
