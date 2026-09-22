const Inventory = require("../models/Inventory.model");

// Đọc tồn kho theo lô, không tạo hoặc cập nhật Inventory khi khách xem hàng.
const findByVariantIds = (variantIds) => {
  return Inventory.find({ variantId: { $in: variantIds } })
    .select("variantId quantity")
    .lean();
};

module.exports = { findByVariantIds };
