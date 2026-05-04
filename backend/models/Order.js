const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    orderId: {
      type: String,
      unique: true,
      required: true,
    },
    userId: { type: String, required: true },
    userEmail: { type: String, required: true },
    items: [
      {
        productId: { type: Number, required: true },
        name: { type: String, required: true },
        size: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        unitPrice: { type: Number, required: true },
      },
    ],
    shippingAddress: {
      fullName: { type: String, required: true },
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zip: { type: String, required: true },
      country: { type: String, required: true },
    },
    subtotal: { type: Number, required: true },
    tierDiscount: { type: Number, default: 0 },
    pointsDiscount: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    deliveryFee: { type: Number, default: 0 },
    total: { type: Number, required: true },
    loyaltyPointsEarned: { type: Number, default: 0 },
    loyaltyTierAtPurchase: { type: String, default: "none" },
    couponId: { type: mongoose.Schema.Types.ObjectId, ref: "Coupon", default: null },
    couponCode: { type: String, default: "" },
    couponDiscount: { type: Number, default: 0, min: 0 },
    couponUsageStatus: {
      type: String,
      enum: ["none", "pending", "applied", "refunded"],
      default: "none",
    },
    redeemPointsRequested: { type: Number, default: 0, min: 0 },
    redeemPointsApplied: { type: Number, default: 0, min: 0 },
    pointsRedemptionStatus: {
      type: String,
      enum: ["none", "pending", "deducted", "refunded"],
      default: "none",
    },
    loyaltyProcessed: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["pending", "processing", "shipped", "delivered", "cancelled", "expired"],
      default: "pending",
    },
    paymentMethod: { type: String, default: "simulated" },
    stripeSessionId: { type: String, default: null },
    stripePaymentIntentId: { type: String, default: null },
    expiresAt: { type: Date, required: true },
    paidAt: { type: Date, default: null },

    // Delivery details captured at checkout
    deliveryDetails: {
      recipientName: { type: String, default: "" },
      contactNumber: { type: String, default: "" },
      deliveryNotes: { type: String, default: "" },
      deliveryMethod: {
        type: String,
        enum: ["standard", "express", "same-day"],
        default: "standard",
      },
      scheduledDate: { type: Date, default: null },
      scheduledTimeSlot: {
        type: String,
        enum: ["morning", "afternoon", "evening", "any"],
        default: "any",
      },
    },
    deliveryId: { type: String, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Order", orderSchema);
