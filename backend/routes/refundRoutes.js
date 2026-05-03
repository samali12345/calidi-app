const express = require("express");
const router = express.Router();
const { protectJWT } = require("../middleware/authJWT");
const { requireAdmin } = require("../middleware/admin");
const Refund = require("../models/Refund");
const Order = require("../models/Order");

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

// Admin views pending refund requests
router.get("/admin/refunds", protectJWT, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Admin access required" });
    const refunds = await Refund.find().sort({ createdAt: -1 });
    res.json(refunds);
  } catch (err) {
    console.error("Admin fetch refunds error:", err);
    res.status(500).json({ error: "Failed to fetch refund requests" });
  }
});

// Admin approves/rejects refund
router.put("/admin/refunds/:id", protectJWT, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: "Admin access required" });
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
      // Update order status to 'refunded'
      await Order.findOneAndUpdate({ orderId: refund.orderId }, { status: "refunded" });
    }

    res.json(refund);
  } catch (err) {
    console.error("Admin update refund error:", err);
    res.status(500).json({ error: "Failed to update refund request" });
  }
});

module.exports = router;
