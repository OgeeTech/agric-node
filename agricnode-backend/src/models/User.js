const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: { type: String, trim: true },
    areaCouncil: {
      type: String,
      enum: ["Bwari", "Gwagwalada", "Kuje", "Kwali", "Abaji", "AMAC"],
    },
    nin: {
      type: String,
      unique: true,
      sparse: true, // Allows null before registration completes, enforces uniqueness once set
      match: [/^\d{11}$/, "NIN must be exactly 11 digits"],
    },
    isRegistered: { type: Boolean, default: false },
    role: {
      type: String,
      enum: ["farmer", "buyer", "aggregator"],
      default: "farmer",
    },
    walletBalance: { type: Number, default: 0 },
    escrowBalance: { type: Number, default: 0 }, // Funds currently locked in active orders
  },
  { timestamps: true },
);

module.exports = mongoose.model("User", userSchema);
