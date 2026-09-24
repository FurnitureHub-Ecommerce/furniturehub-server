const mongoose = require("mongoose");

const inventorySchema = new mongoose.Schema(
  {
    variantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ProductVariant",
      required: true,
      unique: true,
    },

    quantity: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
      validate: Number.isSafeInteger,
    },

    lowStockThreshold: {
      type: Number,
      default: 3,
      min: 0,
      validate: Number.isSafeInteger,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Inventory", inventorySchema);
