/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Thực hiện các thao tác truy vấn MongoDB
 * đối với collection carts và collection inventories.
 *
 * Bước 1: Import Cart Model và Inventory Model.
 * Bước 2: Tìm Cart theo userId.
 * Bước 3: Tìm hoặc tạo Cart cho User.
 * Bước 4: Lưu Cart sau khi thay đổi.
 * Bước 5: Tìm thông tin tồn kho của một Variant.
 * Bước 6: Export các hàm cho Service.
 *
 * Lưu ý:
 * - Repository chỉ thực hiện truy vấn database.
 * - Toàn bộ kiểm tra nghiệp vụ (tồn kho, trùng Variant...)
 *   được xử lý ở tầng Service.
 * - Inventory Model được dùng tại đây vì chưa có
 *   inventory.repository.js riêng. Khi dự án mở rộng,
 *   nên tách ra thành inventory.repository.js.
 */

const Cart = require("../models/Cart.model");
const Inventory = require("../models/Inventory.model");

/**
 * Bước 2: Tìm Cart của một User.
 *
 * - Nhận userId từ Service.
 * - Tìm Cart theo userId.
 * - Populate variantId để lấy thông tin biến thể và sản phẩm.
 * - Trả về Cart hoặc null nếu chưa có.
 *
 * Populate cần đủ thông tin để Frontend hiển thị:
 * - Thông tin Variant: sku, color, size, material, price, isActive.
 * - Thông tin Product qua productId: name, images, isActive.
 *
 * Không populate userId vì Controller đã có userId từ JWT.
 */
const findByUserId = async (userId) => {
  return Cart.findOne({ userId }).populate({
    path: "items.variantId",
    select: "sku color size material price isActive productId",
    populate: {
      path: "productId",
      select: "name images isActive",
    },
  });
};

/**
 * Bước 3: Tìm hoặc tạo Cart cho User.
 *
 * - Nhận userId từ Service.
 * - Tìm Cart theo userId.
 * - Nếu chưa có Cart, tạo mới với items rỗng.
 * - Trả về Cart (đã có hoặc vừa tạo).
 *
 * Không populate ở bước này vì Service cần làm việc
 * trực tiếp với ObjectId của variantId để so sánh.
 * Sau khi lưu, Service sẽ gọi findByUserId để lấy
 * dữ liệu đầy đủ có populate cho Controller.
 */
const findOrCreate = async (userId) => {
  // Tìm Cart hiện tại của User.
  let cart = await Cart.findOne({ userId });

  // Nếu User chưa có Cart, tạo mới với danh sách items rỗng.
  if (!cart) {
    cart = await Cart.create({ userId, items: [] });
  }

  return cart;
};

/**
 * Bước 4: Lưu Cart vào database.
 *
 * - Nhận document Cart đã được chỉnh sửa trong bộ nhớ.
 * - Gọi .save() để đồng bộ lên MongoDB.
 * - Mongoose tự động cập nhật updatedAt.
 * - Mongoose chạy validation trước khi lưu.
 * - Trả về Cart sau khi lưu.
 */
const save = async (cart) => {
  return cart.save();
};

/**
 * Bước 5: Lấy thông tin tồn kho của một Variant.
 *
 * - Nhận variantId từ Service.
 * - Tìm Inventory theo variantId.
 * - Mỗi Variant có tối đa một bản ghi Inventory (unique variantId).
 * - Trả về Inventory hoặc null nếu chưa có bản ghi.
 *
 * Nếu trả về null, Service sẽ coi tồn kho bằng 0
 * và từ chối thêm vào giỏ hàng.
 */
const findInventoryByVariantId = async (variantId) => {
  return Inventory.findOne({ variantId });
};

// Bước 6: Export các hàm cho Service sử dụng.
module.exports = {
  findByUserId,
  findOrCreate,
  save,
  findInventoryByVariantId,
};
