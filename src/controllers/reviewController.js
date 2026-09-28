const reviewService = require("../services/reviewService");

// Giữ response convention và không lộ lỗi database/stack ra client.
const handleError = (res, error) => {
  const statusCode = error.code === 11000 ? 409
    : [400, 401, 403, 404, 409].includes(error.statusCode) ? error.statusCode : 500;
  return res.status(statusCode).json({
    message: error.code === 11000 ? "You already have an active review for this product"
      : statusCode === 500 ? "Internal server error" : error.message,
    ...(statusCode === 400 && error.errors ? { errors: error.errors } : {}),
  });
};

const create = async (req, res) => {
  try {
    const review = await reviewService.create(req.user.userId, req.body);
    return res.status(201).json({ message: "Review created successfully", review });
  } catch (error) { return handleError(res, error); }
};

const getByProduct = async (req, res) => {
  try {
    return res.status(200).json(await reviewService.getByProduct(req.params.productId, req.query));
  } catch (error) { return handleError(res, error); }
};

const update = async (req, res) => {
  try {
    const review = await reviewService.update(req.user.userId, req.params.id, req.body);
    return res.status(200).json({ message: "Review updated successfully", review });
  } catch (error) { return handleError(res, error); }
};

const remove = async (req, res) => {
  try {
    await reviewService.remove(req.user.userId, req.params.id);
    return res.status(200).json({ message: "Review deactivated successfully" });
  } catch (error) { return handleError(res, error); }
};

module.exports = { create, getByProduct, update, remove };
