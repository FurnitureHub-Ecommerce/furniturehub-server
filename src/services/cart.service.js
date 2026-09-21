/**
 * @Author: Minh Truong
 *
 * Mục đích:
 * Xử lý toàn bộ nghiệp vụ giỏ hàng của FurnitureHub.
 *
 * Bước 1: Import Mongoose và các Repository.
 * Bước 2: Tạo hàm xử lý lỗi nghị vụ.
 * Bước 3: Kiểm tra ObjectId hợp lệ.
 * Bước 4: Xử lý thêm sản phẩm vào giỏ hàng.
 * Bước 5: Lấy giỏ hàng và tính toán tổng tiền.
 * Bước 6: Cập nhật số lượng CartItem.
 * Bước 7: Xóa một CartItem khỏi giỏ hàng.
 * Bước 8: Xóa toàn bộ giỏ hàng.
 * Bước 9: Export các hàm cho Controller.
 *
 * Lưu ý quan trọng:
 * - Giá sản phẩm PHẢI lấy từ Variant.price tại Backend.
 *   Frontend không được phép gửi giá để tránh gian lận.
 * - Thêm sản phẩm vào giỏ KHÔNG làm giảm Inventory.
 *   Inventory chỉ bị trừ khi Checkout hoàn tất.
 * - Khi Variant đã có trong giỏ, tăng quantity thay vì tạo item mới.
 *   unitPrice GIỮ NGUYÊN theo snapshot ban đầu, không cập nhật.
 *   Nếu giá đã thay đổi, nghiệp vụ Checkout sẽ kiểm tra lại.
 */

const mongoose = require("mongoose");

const cartRepository = require("../repositories/cart.repository");

const variantRepository = require(
  "../repositories/productVariant.repository"
);

const productRepository = require(
  "../repositories/product.repository"
);

/**
 * Bước 2: Tạo lỗi nghiệp vụ.
 *
 * - Nhận thông báo lỗi và HTTP status.
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
 * Bước 3: Kiểm tra ObjectId hợp lệ.
 *
 * - Nhận ID cần kiểm tra và tên field để thông báo lỗi rõ ràng.
 * - Kiểm tra định dạng ObjectId 24 ký tự hex của MongoDB.
 * - Nếu không hợp lệ, ném lỗi 400.
 * - Tránh thực hiện truy vấn với ID sai định dạng
 *   vì Mongoose sẽ ném lỗi CastError khó xử lý.
 */
const validateObjectId = (id, fieldName = "ID") => {
  if (
    typeof id !== "string" ||
    !mongoose.isObjectIdOrHexString(id)
  ) {
    throw makeError(`Invalid ${fieldName}`, 400);
  }
};

/**
 * Bước 4: Thêm sản phẩm vào giỏ hàng.
 *
 * Input:
 * - userId: ID của CUSTOMER lấy từ JWT (req.user.userId).
 * - variantId: ID của ProductVariant cần thêm.
 * - quantity: Số lượng cần thêm (đã validate là số nguyên dương).
 *
 * Output:
 * - Cart đã được cập nhật, có đầy đủ thông tin populate.
 *
 * Luồng xử lý:
 *
 * 1. Kiểm tra variantId hợp lệ.
 * 2. Tìm Variant trong database.
 * 3. Kiểm tra Variant đang hoạt động (isActive).
 * 4. Tìm Product của Variant.
 * 5. Kiểm tra Product đang hoạt động (isActive).
 * 6. Lấy thông tin tồn kho (Inventory) của Variant.
 * 7. Kiểm tra tồn kho đủ để thêm vào giỏ.
 * 8. Tìm hoặc tạo Cart của User.
 * 9. Tìm xem Variant đã có trong Cart chưa.
 * 10a. Nếu đã có: kiểm tra tổng quantity mới, cập nhật quantity.
 * 10b. Nếu chưa có: tạo CartItem mới với snapshot giá từ Backend.
 * 11. Lưu Cart và trả về dữ liệu đầy đủ.
 *
 * Các lỗi nghiệp vụ:
 * - variantId không hợp lệ: 400.
 * - Variant không tồn tại hoặc isActive=false: 404.
 * - Product của Variant không tồn tại hoặc isActive=false: 404.
 * - Không có Inventory hoặc tồn kho = 0: 400.
 * - Tổng quantity sau khi cộng vượt tồn kho: 400.
 */
const addItem = async (userId, variantId, quantity) => {
  // Bước 1: Kiểm tra variantId đúng định dạng ObjectId.
  validateObjectId(variantId, "variant ID");

  // Bước 2: Tìm Variant trong database.
  const variant = await variantRepository.findById(variantId);

  // Bước 3: Variant không tồn tại hoặc đã ngừng bán.
  // Không cho phép thêm Variant inactive vào giỏ hàng.
  if (!variant || !variant.isActive) {
    throw makeError("Product variant not found", 404);
  }

  // Bước 4: Tìm Product cha của Variant.
  // productId nằm trong Variant document.
  const product = await productRepository.findById(
    variant.productId.toString()
  );

  // Bước 5: Product không tồn tại hoặc đã ngừng kinh doanh.
  // Dù Variant isActive, nếu Product đã bị tắt thì không cho bán.
  if (!product || !product.isActive) {
    throw makeError("Product not found", 404);
  }

  // Bước 6: Lấy thông tin tồn kho của Variant.
  const inventory =
    await cartRepository.findInventoryByVariantId(variantId);

  // Bước 7: Kiểm tra tồn kho.
  // Nếu chưa có bản ghi Inventory, coi như tồn kho bằng 0.
  // Nếu tồn kho = 0, không cho phép thêm vào giỏ hàng.
  const availableStock = inventory ? inventory.quantity : 0;

  if (availableStock === 0) {
    throw makeError("Product variant is out of stock", 400);
  }

  // Bước 8: Tìm Cart của User, nếu chưa có thì tạo mới.
  // findOrCreate đảm bảo luôn trả về một Cart document.
  const cart = await cartRepository.findOrCreate(userId);

  // Bước 9: Tìm xem Variant đã có trong Cart chưa.
  // So sánh bằng .toString() vì Mongoose lưu ObjectId không phải string.
  const existingItemIndex = cart.items.findIndex(
    (item) => item.variantId.toString() === variantId
  );

  if (existingItemIndex !== -1) {
    /*
     * Bước 10a: Variant đã có trong Cart.
     *
     * Tăng quantity thay vì tạo item mới (Cart Rule #5).
     * Kiểm tra tổng quantity mới TRƯỚC KHI cập nhật.
     *
     * Ví dụ:
     * - Giỏ đang có 3 chiếc ghế.
     * - Khách thêm 2 chiếc nữa.
     * - Tổng mới = 5. Nếu tồn kho < 5 thì từ chối.
     *
     * unitPrice GIỮ NGUYÊN snapshot ban đầu.
     * Nếu giá đã thay đổi kể từ lần thêm đầu tiên,
     * nghiệp vụ Checkout sẽ so sánh và xử lý sau.
     */
    const newQuantity =
      cart.items[existingItemIndex].quantity + quantity;

    if (newQuantity > availableStock) {
      throw makeError(
        `Insufficient stock. Available: ${availableStock}, Requested total: ${newQuantity}`,
        400
      );
    }

    // Cập nhật quantity của item đã có.
    cart.items[existingItemIndex].quantity = newQuantity;
  } else {
    /*
     * Bước 10b: Variant chưa có trong Cart.
     *
     * Kiểm tra quantity yêu cầu không vượt tồn kho.
     * Tạo CartItem mới với:
     * - variantId: ID của Variant.
     * - quantity: số lượng khách yêu cầu.
     * - unitPrice: GIÁ LẤY TỪ BACKEND (variant.price).
     *   Không dùng giá Frontend gửi lên.
     */
    if (quantity > availableStock) {
      throw makeError(
        `Insufficient stock. Available: ${availableStock}, Requested: ${quantity}`,
        400
      );
    }

    cart.items.push({
      variantId,
      quantity,
      unitPrice: variant.price,
    });
  }

  // Bước 11: Lưu Cart vào database.
  await cartRepository.save(cart);

  /*
   * Trả về Cart với đầy đủ thông tin populate.
   *
   * Gọi findByUserId sau khi save để có dữ liệu
   * Variant và Product đã được populate cho Frontend.
   * Cách này đảm bảo response luôn nhất quán
   * với GET /api/cart.
   */
  return cartRepository.findByUserId(userId);
};

/**
 * Bước 5: Lấy giỏ hàng và tính toán tổng tiền.
 *
 * Input:
 * - userId: ID của CUSTOMER lấy từ JWT.
 *
 * Output:
 * - Đối tượng chứa cart và các giá trị tính toán:
 *   + items: danh sách CartItem đã populate Variant và Product.
 *   + totalQuantity: tổng số lượng sản phẩm trong giỏ.
 *   + totalAmount: tổng tiền của toàn bộ giỏ hàng.
 *   + Mỗi item được bổ sung thêm field itemSubtotal.
 *
 * Luồng xử lý:
 * 1. Tìm Cart theo userId (đã có populate sẵn).
 * 2. Nếu chưa có Cart, trả về cấu trúc rỗng.
 * 3. Duyệt qua từng item, tính itemSubtotal = unitPrice * quantity.
 * 4. Tính totalQuantity và totalAmount từ danh sách items.
 * 5. Trả về dữ liệu đầy đủ cho Controller.
 *
 * Lưu ý:
 * - totalAmount và itemSubtotal KHÔNG lưu xuống database.
 *   Tính toán on-the-fly mỗi lần GET để đảm bảo chính xác.
 * - Sử dụng Math.round để tránh sai số dấu phẩy động.
 *   Ví dụ: 8500000 * 3 = 25500000 (không có sai số).
 *   Nhưng với giá thập phân: 99.9 * 3 = 299.70000000000005.
 *   Math.round giữ số nguyên nếu đơn vị là VND.
 */
const getCart = async (userId) => {
  // Bước 1: Tìm Cart theo userId với đầy đủ populate.
  const cart = await cartRepository.findByUserId(userId);

  // Bước 2: Nếu User chưa có Cart, trả về cấu trúc rỗng.
  // Không tạo Cart mới ở đây để tránh tạo document trống.
  // Cart sẽ được tạo lần đầu khi User thêm item vào giỏ.
  if (!cart || cart.items.length === 0) {
    return {
      items: [],
      totalQuantity: 0,
      totalAmount: 0,
    };
  }

  // Bước 3: Tính itemSubtotal cho từng CartItem.
  // itemSubtotal = unitPrice (snapshot giá) * quantity.
  // Dùng .toObject() để chuyển Mongoose document thành plain object
  // cho phép bổ sung field itemSubtotal không có trong Schema.
  const itemsWithSubtotal = cart.items.map((item) => {
    const plain = item.toObject();

    // Tính tiền từng dòng sản phẩm.
    plain.itemSubtotal = Math.round(plain.unitPrice * plain.quantity);

    return plain;
  });

  // Bước 4: Tính tổng số lượng và tổng tiền toàn giỏ hàng.
  const totalQuantity = itemsWithSubtotal.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  // totalAmount là tổng của tất cả itemSubtotal.
  // Không nhân lại từ unitPrice * quantity để tránh tính hai lần.
  const totalAmount = itemsWithSubtotal.reduce(
    (sum, item) => sum + item.itemSubtotal,
    0
  );

  // Bước 5: Trả về dữ liệu đầy đủ.
  return {
    _id: cart._id,
    userId: cart.userId,
    items: itemsWithSubtotal,
    totalQuantity,
    totalAmount,
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt,
  };
};

/**
 * Bước 6: Cập nhật số lượng một CartItem.
 *
 * Input:
 * - userId: ID của CUSTOMER lấy từ JWT.
 * - itemId: _id của CartItem (subdocument) trong mảng items.
 * - quantity: Số lượng mới, đã được Validator kiểm tra là số nguyên dương.
 *
 * Luồng xử lý:
 * 1. Kiểm tra itemId đúng định dạng ObjectId.
 * 2. Tìm Cart của User.
 * 3. Kiểm tra Cart tồn tại.
 * 4. Tìm CartItem theo itemId trong mảng items.
 * 5. Kiểm tra CartItem tồn tại.
 * 6. Lấy tồn kho hiện tại của Variant.
 * 7. Kiểm tra quantity mới không vượt tồn kho.
 * 8. Cập nhật quantity.
 * 9. Lưu Cart và trả về dữ liệu đầy đủ.
 *
 * Các lỗi nghị vụ:
 * - itemId không hợp lệ: 400.
 * - Cart không tồn tại: 404.
 * - CartItem không tồn tại: 404.
 * - Tồn kho không đủ: 400.
 *
 * Lưu ý:
 * CUSTOMER chỉ xử lý được item trong giỏ của chính mình
 * vì Cart được tìm theo userId từ JWT.
 */
const updateItem = async (userId, itemId, quantity) => {
  // Bước 1: Kiểm tra định dạng itemId.
  validateObjectId(itemId, "item ID");

  // Bước 2: Tìm Cart của User (không populate để làm việc trực tiếp với ObjectId).
  const cart = await cartRepository.findOrCreate(userId);

  // Bước 3: Kiểm tra Cart có item nào không.
  if (!cart || cart.items.length === 0) {
    throw makeError("Cart item not found", 404);
  }

  // Bước 4: Tìm CartItem trong mảng items theo _id của subdocument.
  // Mongoose cấp phương thức .id() để tìm subdocument theo _id.
  const item = cart.items.id(itemId);

  // Bước 5: ItemId không khớp với bất kỳ item nào trong giỏ.
  if (!item) {
    throw makeError("Cart item not found", 404);
  }

  // Bước 6: Lấy tồn kho hiện tại của Variant.
  const inventory = await cartRepository.findInventoryByVariantId(
    item.variantId.toString()
  );

  // Tồn kho hiện tại. Nếu không có bản ghi Inventory,
  // vẫn cần kiểm tra để tránh trường hợp tồn kho đã bị xóa sau khi thêm vào giỏ.
  const availableStock = inventory ? inventory.quantity : 0;

  // Bước 7: Kiểm tra quantity mới không vượt tồn kho hiện tại.
  if (quantity > availableStock) {
    throw makeError(
      `Insufficient stock. Available: ${availableStock}, Requested: ${quantity}`,
      400
    );
  }

  // Bước 8: Cập nhật quantity của item.
  // Mongoose tự đánh dấu subdocument đã thay đổi (dirty tracking).
  item.quantity = quantity;

  // Bước 9: Lưu Cart và trả về dữ liệu đầy đủ có populate.
  await cartRepository.save(cart);
  return getCart(userId);
};

/**
 * Bước 7: Xóa một CartItem khỏi giỏ hàng.
 *
 * Input:
 * - userId: ID của CUSTOMER lấy từ JWT.
 * - itemId: _id của CartItem cần xóa.
 *
 * Luồng xử lý:
 * 1. Kiểm tra itemId hợp lệ.
 * 2. Tìm Cart của User.
 * 3. Tìm CartItem trong giỏ.
 * 4. Kiểm tra CartItem tồn tại.
 * 5. Xóa item khỏi mảng và lưu.
 * 6. Trả về giỏ hàng sau khi xóa.
 *
 * Xóa item không ảnh hưởng Inventory.
 * Inventory chỉ giảm khi Checkout hoàn tất.
 *
 * CUSTOMER chỉ xóa được item trong giỏ của chính mình
 * vì Cart được tìm theo userId từ JWT.
 */
const removeItem = async (userId, itemId) => {
  // Bước 1: Kiểm tra định dạng itemId.
  validateObjectId(itemId, "item ID");

  // Bước 2: Tìm Cart không có populate để làm việc với ObjectId.
  const cart = await cartRepository.findOrCreate(userId);

  // Bước 3: Tìm CartItem theo _id của subdocument.
  const item = cart.items.id(itemId);

  // Bước 4: ItemId không tồn tại trong giỏ.
  if (!item) {
    throw makeError("Cart item not found", 404);
  }

  // Bước 5: Xóa item khỏi mảng items.
  // .pull() là phương thức của Mongoose DocumentArray,
  // xóa subdocument khỏi mảng theo _id.
  cart.items.pull(itemId);

  // Lưu lại Cart đã cập nhật.
  await cartRepository.save(cart);

  // Bước 6: Trả về giỏ hàng sau khi xóa (có populate).
  return getCart(userId);
};

/**
 * Bước 8: Xóa toàn bộ giỏ hàng.
 *
 * Input:
 * - userId: ID của CUSTOMER lấy từ JWT.
 *
 * Luồng xử lý:
 * 1. Tìm Cart của User.
 * 2. Nếu không có Cart hoặc đã rỗng, trả về thành công ngay.
 * 3. Xóa toàn bộ items.
 * 4. Lưu Cart rỗng.
 *
 * Không xóa Cart document khỏi database.
 * Chỉ làm rỗng mảng items để giữ lại Cart cho lần mua sắp tới.
 * Thao tác này là idempotent: gọi nhiều lần vẫn cho kết quả như nhau.
 */
const clearCart = async (userId) => {
  // Bước 1: Tìm Cart của User.
  const cart = await cartRepository.findOrCreate(userId);

  // Bước 2: Nếu đã rỗng, không cần lưu.
  if (cart.items.length === 0) {
    return;
  }

  // Bước 3: Xóa toàn bộ items bằng cách gán mảng rỗng.
  cart.items = [];

  // Bước 4: Lưu Cart vào database.
  await cartRepository.save(cart);
};

// Bước 9: Export các hàm cho Controller.
module.exports = {
  addItem,
  getCart,
  updateItem,
  removeItem,
  clearCart,
};
