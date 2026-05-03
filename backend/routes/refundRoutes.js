const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/admin");
const Refund = require("../models/Refund");
const Order = require("../models/Order");

// User requests a refund
router.post("/refunds/request/:id", protect, async (req, res) => {
  try {
    const { id: orderId } = req.params;
    const { reason } = req.body;
    
    // Check if order exists and belongs to user
    const order = await Order.findOne({ orderId, userId: req.user.uid });
    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    // Check if refund already requested
    const existing = await Refund.findOne({ orderId });
    if (existing) {
      return res.status(400).json({ error: "Refund already requested for this order" });
    }

    const refund = new Refund({
      orderId,
      userId: req.user.uid,
      reason,
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
router.get("/refunds/status/:id", protect, async (req, res) => {
  try {
    const { id: orderId } = req.params;
    const refund = await Refund.findOne({ orderId, userId: req.user.uid });
    if (!refund) {
      return res.status(404).json({ error: "No refund request found for this order" });
    }
    
    res.json(refund);
  } catch (err) {
    console.error("Refund status error:", err);
    res.status(500).json({ error: "Failed to fetch refund status" });
  }
});

// Admin views pending refund requests
router.get("/admin/refunds", protect, requireAdmin, async (req, res) => {
  try {
    const refunds = await Refund.find().sort({ createdAt: -1 });
    res.json(refunds);
  } catch (err) {
    console.error("Admin fetch refunds error:", err);
    res.status(500).json({ error: "Failed to fetch refund requests" });
  }
});

// Admin approves/rejects refund
router.put("/admin/refunds/:id", protect, requireAdmin, async (req, res) => {
  try {
    const { id: refundId } = req.params;
    const { status, adminComment } = req.body;
    
    const refund = await Refund.findById(refundId);
    if (!refund) {
      return res.status(404).json({ error: "Refund not found" });
    }

    refund.status = status;
    if (adminComment !== undefined) {
      refund.adminComment = adminComment;
    }
    await refund.save();

    if (status === "approved") {
      await Order.findOneAndUpdate({ orderId: refund.orderId }, { status: "cancelled" });
    }

    res.json(refund);
  } catch (err) {
    console.error("Admin update refund error:", err);
    res.status(500).json({ error: "Failed to update refund request" });
  }
});

module.exports = router;
