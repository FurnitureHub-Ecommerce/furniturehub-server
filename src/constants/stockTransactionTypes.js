const MANUAL_STOCK_TYPES = Object.freeze(["IMPORT", "EXPORT", "ADJUSTMENT"]);
// Giữ các loại đã dùng cho trừ/hoàn kho tự động theo trạng thái đơn hàng.
const ORDER_STOCK_TYPES = Object.freeze(["DEDUCTION", "RESTORE"]);
const STOCK_TRANSACTION_TYPES = Object.freeze([...MANUAL_STOCK_TYPES, ...ORDER_STOCK_TYPES]);

module.exports = { MANUAL_STOCK_TYPES, ORDER_STOCK_TYPES, STOCK_TRANSACTION_TYPES };
