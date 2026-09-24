const inventoryService = require("../services/inventory.service");

const handleError = (res, error) => {
  const statusCode = [400, 401, 404, 409, 503].includes(error.statusCode) ? error.statusCode : 500;
  return res.status(statusCode).json({
    message: statusCode === 500 ? "Internal server error" : error.message,
    ...(statusCode === 400 && error.errors && { errors: error.errors }),
  });
};

const getAll = async (req, res) => {
  try {
    return res.status(200).json(await inventoryService.getAll(req.query));
  } catch (error) { return handleError(res, error); }
};

const getLowStock = async (req, res) => {
  try {
    return res.status(200).json(await inventoryService.getAll(req.query, true));
  } catch (error) { return handleError(res, error); }
};

const getByVariantId = async (req, res) => {
  try {
    return res.status(200).json({ inventory: await inventoryService.getByVariantId(req.params.variantId) });
  } catch (error) { return handleError(res, error); }
};

// Lịch sử chỉ đọc StockTransaction đã có; giữ response { transactions, pagination } của kho.
// Service kiểm tra query, repository lấy thông tin hiển thị cần thiết và không ghi thêm giao dịch.
const getTransactions = async (req, res) => {
  try {
    return res.status(200).json(await inventoryService.getTransactions(req.query));
  } catch (error) { return handleError(res, error); }
};

// Route đã xác thực và phân quyền; chỉ chuyển actor từ JWT để client không giả người thao tác.
// Service trả Inventory và lịch sử sau khi commit thành công; giữ cấu trúc response hiện tại.
const stockAction = (action, message) => async (req, res) => {
  try {
    const result = await inventoryService[action](req.params.variantId, req.body, req.user.userId);
    return res.status(200).json({ message, ...result });
  } catch (error) { return handleError(res, error); }
};

const updateThreshold = async (req, res) => {
  try {
    const inventory = await inventoryService.updateThreshold(req.params.variantId, req.body);
    return res.status(200).json({ message: "Low stock threshold updated successfully", inventory });
  } catch (error) { return handleError(res, error); }
};

module.exports = {
  getAll,
  getLowStock,
  getByVariantId,
  getTransactions,
  importStock: stockAction("importStock", "Stock imported successfully"),
  exportStock: stockAction("exportStock", "Stock exported successfully"),
  adjustStock: stockAction("adjustStock", "Stock adjusted successfully"),
  updateThreshold,
};
