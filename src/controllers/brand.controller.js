const brandService = require("../services/brand.service");

const handleError = (res, error) => {
  console.error(error);

  const statusCode = error.code === 11000
    ? 409
    : error.statusCode || 500;

  return res.status(statusCode).json({
    message:
      statusCode === 500
        ? "Internal server error"
        : error.code === 11000
          ? "Brand name already exists"
          : error.message,
  });
};

const getAll = async (req, res) => {
  try {
    const brands = await brandService.getAll();

    return res.status(200).json({ brands });
  } catch (error) {
    return handleError(res, error);
  }
};

const getAllAdmin = async (req, res) => {
  try {
    const brands = await brandService.getAll(true);

    return res.status(200).json({ brands });
  } catch (error) {
    return handleError(res, error);
  }
};

const getById = async (req, res) => {
  try {
    const brand = await brandService.getById(req.params.id);

    return res.status(200).json({ brand });
  } catch (error) {
    return handleError(res, error);
  }
};

const create = async (req, res) => {
  try {
    const brand = await brandService.create(req.body);

    return res.status(201).json({
      message: "Brand created successfully",
      brand,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const update = async (req, res) => {
  try {
    const brand = await brandService.update(
      req.params.id,
      req.body
    );

    return res.status(200).json({
      message: "Brand updated successfully",
      brand,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const remove = async (req, res) => {
  try {
    await brandService.remove(req.params.id);

    return res.status(200).json({
      message: "Brand deactivated successfully",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

module.exports = {
  getAll,
  getAllAdmin,
  getById,
  create,
  update,
  remove,
};