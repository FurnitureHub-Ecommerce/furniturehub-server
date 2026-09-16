const Category = require("../models/Category.model");

const Product = require("../models/Product.model");

const findAll = (filter = {}) => {
  return Category.find(filter).sort({ createdAt: -1 });
};

const findById = (id) => {
  return Category.findById(id);
};

const findByName = (name) => {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return Category.findOne({
    name: new RegExp(`^${escapedName}$`, "i"),
  });
};

const create = (data) => {
  return Category.create(data);
};

const update = (id, data) => {
  return Category.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });
};

const countProducts = (categoryId) => {
  return Product.countDocuments({ categoryId });
};

module.exports = {
  findAll,
  findById,
  findByName,
  create,
  update,
  countProducts,
};