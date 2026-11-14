const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true }, // e.g., "Rice"
    ussdCode: { type: String, required: true, unique: true }, // e.g., "1"
    imageUrl: { type: String, required: true },
    baseDescription: { type: String, required: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Product", productSchema);
