const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    listingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Listing",
      required: true,
    },
    buyerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    amountPaid: { type: Number, required: true },
    paymentStatus: {
      type: String,
      enum: ["held_in_escrow", "released", "refunded"],
      default: "held_in_escrow",
    },
    deliveryStatus: {
      type: String,
      enum: ["pending_dispatch", "in_transit", "delivered"],
      default: "pending_dispatch",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Order", orderSchema);
