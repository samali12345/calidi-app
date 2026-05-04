const mongoose = require("mongoose");

const deliverySchema = new mongoose.Schema(
  {
    deliveryId: {
      type: String,
      unique: true,
      required: true,
    },
    orderId: { type: String, required: true },
    userId: { type: String, required: true },
    userEmail: { type: String, required: true },

    // Recipient details
    recipientName: { type: String, required: true },
    contactNumber: { type: String, required: true },
    deliveryAddress: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      zip: { type: String, required: true },
      country: { type: String, required: true },
    },
    deliveryNotes: { type: String, default: "" },

    // Delivery method & fee
    deliveryMethod: {
      type: String,
      enum: ["standard", "express", "same-day"],
      default: "standard",
    },
    deliveryFee: { type: Number, default: 0 },

    // Scheduled time slot
    scheduledDate: { type: Date, default: null },
    scheduledTimeSlot: {
      type: String,
      enum: ["morning", "afternoon", "evening", "any"],
      default: "any",
    },

    // Tracking
    status: {
      type: String,
      enum: [
        "pending_pickup",
        "in_transit",
        "delivered",
        "failed",
        "returned",
      ],
      default: "pending_pickup",
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        note: { type: String, default: "" },
      },
    ],

    // Delivery completion
    deliveredAt: { type: Date, default: null },
    proofOfDelivery: { type: String, default: "" },

    // Rider assignment
    riderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    assignedAt: { type: Date, default: null },
    vehicleType: {
      type: String,
      enum: ["bike", "threewheel", "van", "unknown"],
      default: "unknown",
    },

    // Phase 3 live tracking
    currentLocation: { type: String, default: "" },
    etaMinutes: { type: Number, default: null },
    currentLat: { type: Number, default: null },
    currentLng: { type: Number, default: null },
    destinationLat: { type: Number, default: null },
    destinationLng: { type: Number, default: null },
    routePolyline: { type: String, default: "" },
    liveUpdatedAt: { type: Date, default: null },

    // Items summary
    itemCount: { type: Number, default: 0 },
    orderTotal: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Delivery", deliverySchema);
