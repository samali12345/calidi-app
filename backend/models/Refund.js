const mongoose = require("mongoose");

const refundSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true },
    userId: { type: String, required: true },
    reason: { type: String, required: true },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    amount: { type: Number, required: true },
    adminComment: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Refund", refundSchema);
