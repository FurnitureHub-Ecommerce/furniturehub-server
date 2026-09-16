const mongoose = require("mongoose");

const categoryRepository = require("../repositories/category.repository");

const makeError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const validateId = (id) => {
  if (!mongoose.isValidObjectId(id)) {
    throw makeError("Invalid category ID", 400);
  }
};

const getAll = async (isAdmin = false) => {
  const filter = isAdmin ? {} : { isActive: true };

  return categoryRepository.findAll(filter);
};

const getById = async (id) => {
  validateId(id);

  const category = await categoryRepository.findById(id);

  if (!category || !category.isActive) {
    throw makeError("Category not found", 404);
  }

  return category;
};

const create = async (data) => {
  const existing = await categoryRepository.findByName(data.name);

  if (existing) {
    throw makeError("Category name already exists", 409);
  }

  return categoryRepository.create(data);
};

const update = async (id, data) => {
  validateId(id);

  const category = await categoryRepository.findById(id);

  if (!category) {
    throw makeError("Category not found", 404);
  }

  if (data.name !== undefined) {
    const existing = await categoryRepository.findByName(data.name);

    if (existing && existing._id.toString() !== id) {
      throw makeError("Category name already exists", 409);
    }
  }

  return categoryRepository.update(id, data);
};

const remove = async (id) => {
  validateId(id);

  const category = await categoryRepository.findById(id);

  if (!category) {
    throw makeError("Category not found", 404);
  }

  const productCount = await categoryRepository.countProducts(id);

  if (productCount > 0) {
    throw makeError(
      "Cannot deactivate a category that contains products",
      409
    );
  }

  return categoryRepository.update(id, {
    isActive: false,
  });
};

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
};