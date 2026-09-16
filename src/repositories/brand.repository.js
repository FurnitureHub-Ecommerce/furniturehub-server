const Brand = require("../models/Brand.model");

const Product = require("../models/Product.model");

const findAll = (filter = {}) => {
  return Brand.find(filter).sort({ createdAt: -1 });
};

const findById = (id) => {
  return Brand.findById(id);
};

const findByName = (name) => {
  const escapedName = name.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&"
  );

  return Brand.findOne({
    name: new RegExp(`^${escapedName}$`, "i"),
  });
};

const create = (data) => {
  return Brand.create(data);
};

const update = (id, data) => {
  return Brand.findByIdAndUpdate(id, data, {
    new: true,
    runValidators: true,
  });
};

const countProducts = (brandId) => {
  return Product.countDocuments({ brandId });
};

module.exports = {
  findAll,
  findById,
  findByName,
  create,
  update,
  countProducts,
};