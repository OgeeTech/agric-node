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
    buyerEmail: { type: String, required: true },
    amountPaid: { type: Number, required: true },
    paymentReference: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    authorizationUrl: { type: String },
    paymentStatus: {
      type: String,
      enum: ["pending_payment", "held_in_escrow", "released", "refunded"],
      default: "pending_payment",
    },
    deliveryStatus: {
      type: String,
      enum: ["awaiting_payment", "pending_dispatch", "in_transit", "delivered"],
      default: "awaiting_payment",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Order", orderSchema);
