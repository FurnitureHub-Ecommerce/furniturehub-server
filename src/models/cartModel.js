/*
 * @Author: Minh Truong
 *
 * Mục đích:
 * Định nghĩa cấu trúc dữ liệu giỏ hàng của FurnitureHub.
 *
 * Thiết kế:
 * - Mỗi CUSTOMER có đúng một Cart.
 * - Mỗi Cart chứa nhiều CartItem dưới dạng subdocument nhúng.
 * - CartItem tham chiếu đến ProductVariant để lấy thông tin biến thể.
 * - unitPrice là snapshot giá tại thời điểm khách thêm vào giỏ.
 *   Giá này dùng để tính tiền trong giỏ hàng.
 *   Khi Checkout, nghiệp vụ sẽ so sánh lại với giá hiện tại của Variant.
 * - totalAmount KHÔNG lưu xuống database.
 *   Backend tính toán on-the-fly từ danh sách CartItem khi trả response.
 *   Cách này tránh dữ liệu không nhất quán khi giá thay đổi.
 *
 * Quy tắc:
 * 1. Mỗi Cart phải thuộc về một User.
 * 2. Một User chỉ có một Cart (unique userId).
 * 3. Mỗi CartItem phải tham chiếu đến một ProductVariant.
 * 4. Một Variant chỉ xuất hiện một lần trong cùng một Cart.
 *    Ràng buộc này được đảm bảo ở tầng Service, không phải tầng Model.
 * 5. Quantity phải là số nguyên dương, tối thiểu là 1.
 * 6. unitPrice được Backend lấy từ Variant tại thời điểm thêm vào giỏ.
 *    Frontend không được phép gửi giá lên để tránh gian lận giá.
 * 7. Tự động lưu thời gian tạo và cập nhật qua timestamps.
 */

const mongoose = require("mongoose");

/*
 * Định nghĩa CartItem Subdocument Schema.
 *
 * CartItem là subdocument nhúng trực tiếp vào Cart.
 * Mongoose tự động tạo _id cho mỗi CartItem.
 * _id này được dùng làm itemId trong URL của các API
 * PATCH /api/cart/items/:itemId và DELETE /api/cart/items/:itemId.
 *
 * Lý do dùng subdocument thay vì collection riêng:
 * - Giỏ hàng của một khách hàng không bao giờ có hàng trăm item.
 * - Đọc toàn bộ giỏ hàng chỉ cần một query duy nhất.
 * - Xóa item chỉ cần dùng $pull trên mảng items.
 * - Đơn giản hơn, phù hợp với quy mô dự án.
 */
const cartItemSchema = new mongoose.Schema({
  /*
   * Tham chiếu đến ProductVariant.
   *
   * CartItem phải gắn với một Variant cụ thể để biết:
   * - Màu sắc, kích thước, chất liệu của biến thể.
   * - SKU để phân biệt với các biến thể khác.
   * - Trạng thái isActive khi Checkout.
   */
  variantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ProductVariant",
    required: true,
  },

  /*
   * Số lượng sản phẩm trong giỏ hàng.
   *
   * Phải là số nguyên dương, tối thiểu là 1.
   * Không thể là số thập phân (validate ở Service).
   * Không được vượt quá tồn kho khả dụng trong Inventory.
   */
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },

  /*
   * Đơn giá tại thời điểm thêm vào giỏ hàng.
   *
   * Được lấy từ ProductVariant.price tại Backend.
   * Frontend không được phép gửi giá để tránh gian lận.
   * Dùng để tính itemSubtotal = unitPrice * quantity.
   * Khi Checkout, cần so sánh lại với Variant.price hiện tại.
   */
  unitPrice: {
    type: Number,
    required: true,
    min: 0,
  },
});

/*
 * Định nghĩa Cart Schema.
 *
 * Mỗi Cart thuộc về một User duy nhất.
 * userId có index unique để đảm bảo mỗi CUSTOMER chỉ có một Cart.
 */
const cartSchema = new mongoose.Schema(
  {
    /*
     * Xác định CUSTOMER sở hữu giỏ hàng.
     * Tham chiếu đến _id của User.
     * unique: true đảm bảo không tạo hai Cart cho cùng một User.
     */
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    /*
     * Danh sách sản phẩm trong giỏ hàng.
     *
     * Mỗi phần tử là một CartItem subdocument.
     * Mặc định là mảng rỗng khi Cart mới được tạo.
     * Một Variant chỉ xuất hiện một lần trong mảng này.
     * Ràng buộc trùng Variant được kiểm tra ở tầng Service.
     */
    items: {
      type: [cartItemSchema],
      default: [],
    },
  },
  {
    /*
     * Tự động tạo createdAt và updatedAt.
     * updatedAt được cập nhật mỗi khi thêm, sửa, xóa CartItem.
     */
    timestamps: true,
  }
);

// Tạo Model Cart để thao tác với collection carts.
module.exports = mongoose.model("Cart", cartSchema);
