const express = require("express");
const router = express.Router();
const { protectJWT } = require("../middleware/authJWT");
const Refund = require("../models/Refund");
const Order = require("../models/Order");

/**
 * CUSTOMER ROUTES
 */

// User requests a refund
router.post("/refunds/request/:id", protectJWT, async (req, res) => {
  try {
    const { id: orderId } = req.params;
    const { reason, reasonCategory, images } = req.body;
    
    // Check if order exists and belongs to user
    const order = await Order.findOne({ orderId, userId: req.user._id });
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // 7-day validation
    const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
    const orderAge = Date.now() - new Date(order.createdAt).getTime();
    if (orderAge > sevenDaysInMs) {
      return res.status(400).json({ error: "Refund period (7 days) has expired for this order" });
    }

    // Check if refund already requested
    const existing = await Refund.findOne({ orderId });
    if (existing) {
      return res.status(400).json({ error: "Refund already requested for this order" });
    }

    const refund = new Refund({
      orderId,
      userId: req.user._id,
      reason,
      reasonCategory: reasonCategory || "Other",
      images: images || [],
      amount: order.total,
      status: "pending"
    });
    await refund.save();

    res.status(201).json(refund);
  } catch (err) {
    console.error("Refund request error:", err);
    res.status(500).json({ error: "Failed to submit refund request" });
  }
});

// User tracks refund progress
router.get("/refunds/status/:id", protectJWT, async (req, res) => {
  try {
    const { id: orderId } = req.params;
    const refund = await Refund.findOne({ orderId, userId: req.user._id });
    if (!refund) {
      return res.status(404).json({ error: "No refund request found for this order" });
    }
    
    res.json(refund);
  } catch (err) {
    console.error("Refund status error:", err);
    res.status(500).json({ error: "Failed to fetch refund status" });
  }
});

module.exports = router;
