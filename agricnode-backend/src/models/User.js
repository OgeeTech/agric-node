const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      index: true, // Indexed for fast USSD lookups
    },
    name: { type: String }, // Optional initially, updated during USSD onboarding
    role: {
      type: String,
      enum: ["farmer", "buyer", "aggregator"],
      default: "farmer",
    },
    location: { type: String }, // e.g., "Bwari"
    walletBalance: { type: Number, default: 0 },
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
