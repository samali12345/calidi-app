const mongoose = require("mongoose");

const cartActivitySchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true },
    userEmail: { type: String, required: true, trim: true, lowercase: true },
    items: { type: [mongoose.Schema.Types.Mixed], default: [] },
    totalValue: { type: Number, default: 0, min: 0 },
    lastUpdatedAt: { type: Date, default: Date.now },
    notificationSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("CartActivity", cartActivitySchema);
