const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
  authorName: { type: String, required: true, trim: true },
  authorRole: {
    type: String,
    enum: ["buyer", "escrow_admin"],
    default: "buyer",
  },
  text: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now },
});

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
    areaCouncil: { type: String, required: true, default: "Unknown" },
    // Added by Escrow Admin after speaking with the farmer
    imageUrl: { type: String, default: "" },
    description: { type: String, default: "" },
    verifiedByAdmin: { type: Boolean, default: false },
    // Buyer & Admin Q&A comments
    comments: [commentSchema],
  },
  { timestamps: true },
);

module.exports = mongoose.model("Listing", listingSchema);
