/**
 * @Author: Minh Truong
 *
 * Mục đích file:
 * Cung cấp dịch vụ tổng hợp số liệu thống kê (Dashboard Statistics) cho toàn bộ hệ thống FurnitureHub.
 * Tầng Service chịu trách nhiệm thực thi các truy vấn tổng hợp dữ liệu từ MongoDB và tính toán các chỉ số
 * kinh doanh mà không làm thay đổi trạng thái của database (chỉ đọc - read-only).
 *
 * Business Rules đã được xác nhận:
 * 1. totalUsers: Đếm toàn bộ tài khoản người dùng trong hệ thống (bao gồm cả tài khoản active và inactive).
 * 2. totalCustomers: Chỉ đếm các tài khoản có vai trò (role) là "CUSTOMER" (bao gồm cả active và inactive).
 * 3. totalProducts: Chỉ đếm các sản phẩm (Product) đang hoạt động (isActive: true). Không đếm biến thể (ProductVariant)
 *    hay bản ghi tồn kho (Inventory).
 * 4. totalOrders: Đếm tổng số document đơn hàng (Order) trong database, không đếm subdocuments items hay số lượng sản phẩm.
 * 5. ordersByStatus: Thống kê số lượng đơn hàng theo từng trạng thái trong enum quy định (pending, confirmed, rejected, cancelled).
 *    Nếu một trạng thái không có đơn hàng nào, giá trị trả về vẫn phải là 0, không được bỏ qua key.
 * 6. totalRevenue: Doanh thu thực tế được tính từ các khoản thanh toán đã hoàn thành (Payment.status = "paid")
 *    thuộc về các đơn hàng đã được xác nhận (Order.status = "confirmed").
 *    - Không tính các Payment đang chờ (pending), thất bại (failed), hoặc bị hủy (cancelled).
 *    - Không tính các Payment dù đã "paid" nhưng Order bị hủy (cancelled) hoặc từ chối (rejected).
 *    - Không tính các Payment mồ côi (orphan Payment: orderId không trỏ tới Order nào tồn tại).
 *    - Sử dụng giá trị snapshot Payment.amount thay vì tính lại từ giá Product/Variant hiện tại,
 *      vì giá sản phẩm có thể thay đổi sau khi thanh toán được ghi nhận.
 *    - Xử lý làm tròn số học (decimal rounding) để tránh lỗi floating-point đặc trưng của JavaScript (ví dụ: 100.1 + 200.2 = 300.29999999999995).
 */

const User = require("../models/User.model");
const Product = require("../models/Product.model");
const Order = require("../models/Order.model");
const Payment = require("../models/Payment.model");
const { ORDER_STATUSES } = require("../constants/orderStatus");

/**
 * Lấy toàn bộ số liệu thống kê tổng hợp phục vụ màn hình Dashboard quản trị.
 *
 * Hàm thực thi các truy vấn song song (Promise.all) bằng countDocuments và aggregate của MongoDB
 * để tối ưu hiệu năng, tuyệt đối không dùng find() tải toàn bộ collection vào bộ nhớ Node.js.
 *
 * @returns {Promise<Object>} Đối tượng chứa các chỉ số thống kê tổng hợp:
 *   - totalUsers: number
 *   - totalCustomers: number
 *   - totalProducts: number
 *   - totalOrders: number
 *   - totalRevenue: number
 *   - ordersByStatus: Object chứa từng status của Order và số lượng tương ứng
 */
const getStatistics = async () => {
  // Thực hiện đồng thời các truy vấn đếm và tổng hợp dữ liệu để tối đa hóa tốc độ phản hồi.
  const [
    totalUsers,
    totalCustomers,
    totalProducts,
    totalOrders,
    orderStatusCounts,
    revenueAggregation,
  ] = await Promise.all([
    // 1. Đếm tất cả tài khoản người dùng (bao gồm active và inactive).
    User.countDocuments({}),

    // 2. Đếm người dùng có role là CUSTOMER (bao gồm active và inactive).
    User.countDocuments({ role: "CUSTOMER" }),

    // 3. Đếm sản phẩm đang hoạt động (isActive: true).
    Product.countDocuments({ isActive: true }),

    // 4. Đếm tổng số đơn hàng đã tạo trong hệ thống.
    Order.countDocuments({}),

    // 5. Gom nhóm và đếm số lượng đơn hàng theo từng trạng thái (status).
    Order.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]),

    // 6. Tính tổng doanh thu:
    // - Chỉ lấy Payment có status là "paid".
    // - Lookup sang collection "orders" để kiểm tra đơn hàng tương ứng có tồn tại và trạng thái là "confirmed".
    // - Unwind kết quả lookup; nếu đơn hàng không tồn tại (orphan payment) thì pipeline sẽ loại bỏ.
    // - Match kiểm tra order.status === "confirmed".
    // - Group tính tổng trường amount (snapshot số tiền thanh toán thực tế).
    Payment.aggregate([
      {
        $match: {
          status: "paid",
        },
      },
      {
        $lookup: {
          from: "orders",
          localField: "orderId",
          foreignField: "_id",
          as: "order",
        },
      },
      {
        $unwind: "$order",
      },
      {
        $match: {
          "order.status": "confirmed",
        },
      },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$amount" },
        },
      },
    ]),
  ]);

  // Khởi tạo object ordersByStatus với đầy đủ các key trạng thái theo ORDER_STATUSES, mặc định bằng 0.
  // Đảm bảo không bị thiếu key kể cả khi database chưa có đơn hàng nào ở trạng thái đó.
  const ordersByStatus = {};
  for (const status of ORDER_STATUSES) {
    ordersByStatus[status] = 0;
  }

  // Điền số lượng đơn hàng thực tế vào từng trạng thái từ kết quả aggregation.
  for (const item of orderStatusCounts) {
    if (Object.prototype.hasOwnProperty.call(ordersByStatus, item._id)) {
      ordersByStatus[item._id] = item.count;
    }
  }

  // Xử lý doanh thu thô từ kết quả aggregation; nếu không có bản ghi nào thì doanh thu là 0.
  const rawRevenue =
    revenueAggregation.length > 0 ? revenueAggregation[0].totalRevenue : 0;

  // Xử lý sai số dấu phẩy động (floating-point arithmetic) bằng cách làm tròn đến 2 chữ số thập phân (cents),
  // đảm bảo ví dụ 100.1 + 200.2 trả về chính xác 300.3 thay vì 300.29999999999995.
  const totalRevenue = Math.round(rawRevenue * 100) / 100;

  return {
    totalUsers,
    totalCustomers,
    totalProducts,
    totalOrders,
    totalRevenue,
    ordersByStatus,
  };
};

module.exports = {
  getStatistics,
};
