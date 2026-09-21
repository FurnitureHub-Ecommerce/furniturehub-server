/**
 * @Author: Minh Truong
 *
 * Mục đích: kiểm tra tồn kho và tính giá hiện tại cho Cart đã populate của Task 2.
 * Đầu vào: Cart chỉ đọc và danh sách lỗi theo từng vị trí item từ Checkout Service.
 * Bước 1: Cộng số lượng theo Variant, đọc Inventory một lần cho mỗi Variant.
 * Bước 2: Kiểm tra Inventory.quantity, giá ProductVariant.price và từng dòng hàng.
 * Bước 3: Nhân/cộng bằng BigInt theo phần thập phân, chỉ trả Number khi không mất số.
 * Bước 4: Trả toàn bộ chẩn đoán; totalAmount=null khi bất kỳ điều kiện nào bị lỗi.
 * Không ghi Cart, Inventory hay Order; không trừ/giữ hàng hoặc áp dụng phí/giảm giá.
 */

const cartRepository = require("../repositories/cart.repository");

/**
 * Nhận số hữu hạn không âm đã kiểm tra, tách thành hệ số nguyên và số chữ số lẻ.
 * Đọc chuỗi thập phân của Number, kể cả dạng 1e-7, để không nhân số thực trực tiếp.
 * Ví dụ 12.34 trở thành 1234n với scale=2; 1e3 trở thành 1000n với scale=0.
 * Cách này giữ giá nguyên VND và hỗ trợ giá thập phân mà schema hiện tại cho phép.
 */
const toDecimal = (value) => {
  const [mantissa, exponent = "0"] = value.toString().split("e");
  const [whole, fraction = ""] = mantissa.split(".");
  const scale = fraction.length - Number(exponent);
  const coefficient = BigInt(whole + fraction);
  return scale < 0
    ? { coefficient: coefficient * 10n ** BigInt(-scale), scale: 0 }
    : { coefficient, scale };
};

/**
 * Đổi số tiền chính xác về Number dùng trong JSON, không đổi hợp đồng sang chuỗi.
 * Từ chối số vượt MAX_SAFE_INTEGER hoặc bị làm tròn khi chuyển về Number.
 * Đổi ngược Number về thập phân và so sánh cùng thang đo để phát hiện mất chữ số.
 * Trả null khi không thể biểu diễn chính xác; không tự làm tròn hay trả tổng sai.
 */
const toAmount = ({ coefficient, scale }) => {
  const amount = Number(`${coefficient}e-${scale}`);
  if (!Number.isFinite(amount) || amount > Number.MAX_SAFE_INTEGER) return null;
  const converted = toDecimal(amount);
  const commonScale = Math.max(scale, converted.scale);
  return coefficient * 10n ** BigInt(commonScale - scale) ===
    converted.coefficient * 10n ** BigInt(commonScale - converted.scale)
    ? amount
    : null;
};

/**
 * Nhận hai số thập phân không âm, nâng về cùng scale trước khi cộng hệ số nguyên.
 * Hàm trả đối tượng mới, không thay đổi số tiền từng dòng hay tổng trước đó.
 */
const addAmounts = (left, right) => {
  const scale = Math.max(left.scale, right.scale);
  return {
    coefficient: left.coefficient * 10n ** BigInt(scale - left.scale) +
      right.coefficient * 10n ** BigInt(scale - right.scale),
    scale,
  };
};

/**
 * Cart và itemErrors có cùng thứ tự; lỗi số lượng/trạng thái được Task 2 kiểm tra.
 * Vẫn duyệt mọi item, kể cả item thiếu hoặc Variant bị xóa, không bỏ qua dòng lỗi.
 * Gộp quantity nguyên dương an toàn của mọi dòng cùng Variant trước khi so tồn kho;
 * tổng vượt giới hạn số nguyên được báo lỗi cho cả nhóm, không duyệt riêng từng dòng.
 * Inventory thiếu khác với tồn kho bằng 0; quantity sai kiểu/âm/lẻ đều bị từ chối.
 * Đọc lean để Mongoose không ép kiểu hoặc bổ sung mặc định che giấu dữ liệu lỗi.
 * Giá chỉ lấy từ Variant.price; không dùng hoặc cập nhật snapshot CartItem.unitPrice.
 * Giữ phần thập phân theo schema; lỗi biểu diễn tiền trả mã lỗi, không làm tròn ngầm.
 * Tổng chỉ hợp lệ khi tất cả dòng hợp lệ; lỗi database được chuyển lên Controller.
 */
const calculateStockPrice = async (cart, itemErrors) => {
  const requestedByVariant = new Map();
  for (const item of cart.items) {
    const variantId = item?.variantId?._id?.toString();
    if (!variantId) continue;
    const previous = requestedByVariant.get(variantId) ?? 0n;
    const quantity = Number.isSafeInteger(item.quantity) && item.quantity > 0
      ? BigInt(item.quantity) : 0n;
    requestedByVariant.set(variantId, previous + quantity);
  }

  const inventories = new Map(await Promise.all(
    [...requestedByVariant.keys()].map(async (variantId) => [
      variantId,
      await cartRepository.findInventoryByVariantId(variantId, { lean: true }),
    ])
  ));

  const errors = [];
  let total = { coefficient: 0n, scale: 0 };
  const items = cart.items.map((item, index) => {
    const variant = item?.variantId;
    const identity = {
      itemId: item?._id?.toString() || null,
      variantId: variant?._id?.toString() || null,
    };
    const currentErrors = [...itemErrors[index]];
    const addError = (code, message) => currentErrors.push({ ...identity, code, message });
    const quantityValid = Number.isSafeInteger(item?.quantity) && item.quantity > 0;
    const requested = requestedByVariant.get(identity.variantId);
    const requestedQuantity = requested !== undefined && requested <= BigInt(Number.MAX_SAFE_INTEGER)
      ? Number(requested) : null;
    let availableStock = null;
    let stockValid = false;
    let unitPrice = null;
    let itemSubtotal = null;

    if (variant) {
      const inventory = inventories.get(identity.variantId);
      if (!inventory) {
        addError("INVENTORY_NOT_FOUND", "Inventory record not found");
      } else if (!Number.isSafeInteger(inventory.quantity) || inventory.quantity < 0) {
        addError("INVALID_STOCK", "Inventory quantity must be a non-negative safe integer");
      } else {
        availableStock = inventory.quantity;
        if (requestedQuantity === null) {
          addError("INVALID_QUANTITY_TOTAL", "Combined quantity exceeds the safe integer limit");
        } else if (requestedQuantity > availableStock) {
          addError("INSUFFICIENT_STOCK", `Insufficient stock. Available: ${availableStock}, Requested total: ${requestedQuantity}`);
        } else {
          stockValid = quantityValid;
        }
      }

      if (typeof variant.price !== "number" || !Number.isFinite(variant.price) ||
          variant.price < 0 || variant.price > Number.MAX_SAFE_INTEGER) {
        addError("INVALID_PRICE", "Selling price must be a finite non-negative number within the safe limit");
      } else {
        unitPrice = variant.price;
        if (quantityValid) {
          const price = toDecimal(unitPrice);
          const line = { ...price, coefficient: price.coefficient * BigInt(item.quantity) };
          itemSubtotal = toAmount(line);
          if (itemSubtotal === null) {
            addError("INVALID_ITEM_TOTAL", "Item subtotal cannot be represented safely");
          } else {
            total = addAmounts(total, line);
          }
        }
      }
    }

    errors.push(...currentErrors);
    return {
      ...identity,
      quantity: item?.quantity ?? null,
      requestedQuantity,
      availableStock,
      unitPrice,
      itemSubtotal,
      stockValid,
      valid: currentErrors.length === 0,
    };
  });

  const totalAmount = toAmount(total);
  if (totalAmount === null) {
    errors.push({ code: "INVALID_TOTAL", message: "Cart total cannot be represented safely" });
  }
  const valid = errors.length === 0;
  return {
    message: valid ? "Cart is valid for checkout" : "Cart is invalid for checkout",
    valid,
    items,
    totalAmount: valid ? totalAmount : null,
    ...(valid ? {} : { errors }),
  };
};

module.exports = { calculateStockPrice };
