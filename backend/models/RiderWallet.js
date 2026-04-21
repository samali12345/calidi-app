const mongoose = require("mongoose");

const riderWalletSchema = new mongoose.Schema(
  {
    riderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },
    pendingBalance: { type: Number, default: 0 },
    availableBalance: { type: Number, default: 0 },
    totalEarned: { type: Number, default: 0 },
    totalWithdrawn: { type: Number, default: 0 },
    lastCreditedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("RiderWallet", riderWalletSchema);
