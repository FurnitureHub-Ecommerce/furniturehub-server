const mongoose = require("mongoose");

const brandRepository = require("../repositories/brand.repository");

const makeError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const validateId = (id) => {
  if (!mongoose.isValidObjectId(id)) {
    throw makeError("Invalid brand ID", 400);
  }
};

const getAll = async (isAdmin = false) => {
  const filter = isAdmin ? {} : { isActive: true };

  return brandRepository.findAll(filter);
};

const getById = async (id) => {
  validateId(id);

  const brand = await brandRepository.findById(id);

  if (!brand || !brand.isActive) {
    throw makeError("Brand not found", 404);
  }

  return brand;
};

const create = async (data) => {
  const existing = await brandRepository.findByName(data.name);

  if (existing) {
    throw makeError("Brand name already exists", 409);
  }

  return brandRepository.create(data);
};

const update = async (id, data) => {
  validateId(id);

  const brand = await brandRepository.findById(id);

  if (!brand) {
    throw makeError("Brand not found", 404);
  }

  if (data.name !== undefined) {
    const existing = await brandRepository.findByName(data.name);

    if (existing && existing._id.toString() !== id) {
      throw makeError("Brand name already exists", 409);
    }
  }

  return brandRepository.update(id, data);
};

const remove = async (id) => {
  validateId(id);

  const brand = await brandRepository.findById(id);

  if (!brand) {
    throw makeError("Brand not found", 404);
  }

  const productCount = await brandRepository.countProducts(id);

  if (productCount > 0) {
    throw makeError(
      "Cannot deactivate a brand that contains products",
      409
    );
  }

  return brandRepository.update(id, {
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