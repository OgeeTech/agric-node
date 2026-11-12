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
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
    status: {
      type: String,
      enum: ["available", "pending_escrow", "sold"],
      default: "available",
    },
    areaCouncil: { type: String, required: true },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Listing", listingSchema);
