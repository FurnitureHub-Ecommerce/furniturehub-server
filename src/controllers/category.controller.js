const categoryService = require("../services/category.service");

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
          ? "Category name already exists"
          : error.message,
  });
};

const getAll = async (req, res) => {
  try {
    const categories = await categoryService.getAll();

    return res.status(200).json({ categories });
  } catch (error) {
    return handleError(res, error);
  }
};

const getAllAdmin = async (req, res) => {
  try {
    const categories = await categoryService.getAll(true);

    return res.status(200).json({ categories });
  } catch (error) {
    return handleError(res, error);
  }
};

const getById = async (req, res) => {
  try {
    const category = await categoryService.getById(req.params.id);

    return res.status(200).json({ category });
  } catch (error) {
    return handleError(res, error);
  }
};

const create = async (req, res) => {
  try {
    const category = await categoryService.create(req.body);

    return res.status(201).json({
      message: "Category created successfully",
      category,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const update = async (req, res) => {
  try {
    const category = await categoryService.update(
      req.params.id,
      req.body
    );

    return res.status(200).json({
      message: "Category updated successfully",
      category,
    });
  } catch (error) {
    return handleError(res, error);
  }
};

const remove = async (req, res) => {
  try {
    await categoryService.remove(req.params.id);

    return res.status(200).json({
      message: "Category deactivated successfully",
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