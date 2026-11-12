const mongoose = require("mongoose");

const listingSchema = new mongoose.Schema(
  {
    farmerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    cropType: { type: String, required: true },
    quantity: { type: Number, required: true }, // Assumed unit: kg or bags
    price: { type: Number, required: true }, // Total price or price per unit
    status: {
      type: String,
      enum: ["available", "pending_escrow", "sold"],
      default: "available",
    },
    location: { type: String, required: true }, // Denormalized for faster marketplace querying
  },
  { timestamps: true },
);

module.exports = mongoose.model("Listing", listingSchema);
