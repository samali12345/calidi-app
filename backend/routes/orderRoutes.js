const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const Order = require("../models/Order");
const Product = require("../models/Product");
const User = require("../models/User");
const { finalizeOrderAsPaid } = require("../services/orderPaymentService");
const {
  calculateDiscount,
  calculatePoints,
  getTierInfo,
} = require("../services/loyaltyService");
const { findAndValidateCoupon } = require("../services/couponService");
const CartActivity = require("../models/CartActivity");

// Delivery fee calculation based on method and location
function calculateDeliveryFee(deliveryMethod, totalItems, city) {
  const baseFees = { standard: 350, express: 750, "same-day": 1500 };
  const baseFee = baseFees[deliveryMethod] || 350;
  // Free standard delivery for 5+ items
  if (deliveryMethod === "standard" && totalItems >= 5) return 0;
  return baseFee;
}

// Generate unique order ID
function generateOrderId() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `ORD-${ts}-${rand}`;
}

// POST /api/orders - Create order from cart
router.post("/", protect, async (req, res) => {
  try {
    const { items, shippingAddress, deliveryDetails } = req.body;
    const couponCode = req.body?.couponCode;
    const rawRedeemPoints = req.body?.redeemPoints;
    const redeemPoints =
      rawRedeemPoints === undefined || rawRedeemPoints === null || rawRedeemPoints === ""
        ? 0
        : Number(rawRedeemPoints);

    if (!items || !items.length) {
      return res.status(400).json({ error: "No items provided" });
    }
    if (!shippingAddress || !shippingAddress.fullName || !shippingAddress.street) {
      return res.status(400).json({ error: "Shipping address is required" });
    }
    if (!Number.isInteger(redeemPoints) || redeemPoints < 0) {
      return res.status(400).json({ error: "redeemPoints must be a non-negative integer" });
    }

    // Validate stock and build order items
    const orderItems = [];
    let subtotal = 0;
    let totalItemCount = 0;

    for (const item of items) {
      const product = await Product.findOne({ p_id: item.productId });
      if (!product) {
        return res.status(400).json({ error: `Product ${item.productId} not found` });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({
          error: `Insufficient stock for "${product.name}". Available: ${product.stock}`,
        });
      }

      orderItems.push({
        productId: product.p_id,
        name: product.name,
        size: item.size,
        quantity: item.quantity,
        unitPrice: product.price,
      });

      subtotal += product.price * item.quantity;
      totalItemCount += item.quantity;
    }

    // Calculate loyalty discount
    const user = await User.findOne({ email: req.user.email });
    const tier = user.loyaltyTier || "none";
    const tierDiscount = calculateDiscount(tier, subtotal);
    const maxRedeemable = Math.floor(subtotal * 0.5);

    if (redeemPoints > maxRedeemable) {
      return res.status(400).json({
        error: `You can redeem at most ${maxRedeemable} points for this order`,
      });
    }

    // Reserve against other pending orders to reduce multi-tab overspending.
    const pendingRedemption = await Order.aggregate([
      {
        $match: {
          userEmail: req.user.email,
          status: "pending",
          pointsRedemptionStatus: "pending",
        },
      },
      {
        $group: {
          _id: null,
          totalReserved: { $sum: "$redeemPointsApplied" },
        },
      },
    ]);
    const reservedPoints = pendingRedemption[0]?.totalReserved || 0;
    const availablePoints = Math.max(0, (user.loyaltyPoints || 0) - reservedPoints);

    if (redeemPoints > availablePoints) {
      return res.status(400).json({
        error: `Insufficient loyalty points. Available to redeem right now: ${availablePoints}`,
      });
    }

    const pointsDiscount = redeemPoints;
    const couponBaseTotal = Math.max(0, subtotal - tierDiscount - pointsDiscount);
    let coupon = null;
    let couponDiscount = 0;
    let normalizedCouponCode = "";

    if (couponCode) {
      const couponValidation = await findAndValidateCoupon({
        code: couponCode,
        userId: req.user.uid,
        orderTotal: couponBaseTotal,
      });
      if (!couponValidation.valid || !couponValidation.coupon) {
        return res.status(400).json({ error: couponValidation.reason || "Invalid coupon code" });
      }
      coupon = couponValidation.coupon;
      couponDiscount = couponValidation.discountAmount;
      normalizedCouponCode = coupon.code;
    }

    const discount = tierDiscount + pointsDiscount + couponDiscount;

    // Calculate delivery fee based on method and location
    const method = deliveryDetails?.deliveryMethod || "standard";
    const city = shippingAddress.city || "";
    const deliveryFee = calculateDeliveryFee(method, totalItemCount, city);

    const total = subtotal - discount + deliveryFee;
    const loyaltyPointsEarned = await calculatePoints(total);

    // Decrement stock
    for (const item of orderItems) {
      await Product.updateOne(
        { p_id: item.productId },
        { $inc: { stock: -item.quantity } }
      );
    }

    // Create order with 15-minute expiry
    const order = await Order.create({
      orderId: generateOrderId(),
      userId: req.user.uid,
      userEmail: req.user.email,
      items: orderItems,
      shippingAddress,
      subtotal,
      tierDiscount,
      pointsDiscount,
      couponId: coupon ? coupon._id : null,
      couponCode: normalizedCouponCode,
      couponDiscount,
      couponUsageStatus: coupon ? "pending" : "none",
      discount,
      deliveryFee,
      total,
      loyaltyPointsEarned,
      loyaltyTierAtPurchase: tier,
      redeemPointsRequested: redeemPoints,
      redeemPointsApplied: redeemPoints,
      pointsRedemptionStatus: redeemPoints > 0 ? "pending" : "none",
      status: "pending",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      deliveryDetails: deliveryDetails
        ? {
            recipientName: deliveryDetails.recipientName || shippingAddress.fullName,
            contactNumber: deliveryDetails.contactNumber || "",
            deliveryNotes: deliveryDetails.deliveryNotes || "",
            deliveryMethod: method,
            scheduledDate: deliveryDetails.scheduledDate || null,
            scheduledTimeSlot: deliveryDetails.scheduledTimeSlot || "any",
          }
        : {
            recipientName: shippingAddress.fullName,
            contactNumber: "",
            deliveryNotes: "",
            deliveryMethod: "standard",
            scheduledDate: null,
            scheduledTimeSlot: "any",
          },
    });

    await CartActivity.deleteOne({ userId: req.user.uid });

    res.status(201).json(order);
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// POST /api/orders/:orderId/pay - Simulate payment
router.post("/:orderId/pay", protect, async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.userId !== req.user.uid) {
      return res.status(403).json({ error: "Not authorized" });
    }
    if (new Date(order.expiresAt) < new Date() && order.status === "pending") {
      order.status = "expired";
      await order.save();
      // Restore stock
      for (const item of order.items) {
        await Product.updateOne(
          { p_id: item.productId },
          { $inc: { stock: item.quantity } }
        );
      }
      return res.status(400).json({ error: "Order has expired" });
    }

    const { delivery } = await finalizeOrderAsPaid(order, {
      paymentMethod: "simulated",
    });
    const user = await User.findOne({ email: req.user.email });

    res.json({
      order,
      delivery,
      loyaltyUpdate: {
        pointsEarned: order.loyaltyPointsEarned,
        totalPoints: user?.loyaltyPoints ?? 0,
        tier: user?.loyaltyTier ?? "none",
        totalOrders: user?.totalOrders ?? 0,
      },
    });
  } catch (err) {
    console.error("Pay order error:", err);
    const message = String(err?.message || "").toLowerCase();
    if (message.includes("insufficient loyalty points") || message.includes("coupon can no longer be applied")) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: "Payment failed" });
  }
});

// POST /api/orders/:orderId/cancel - Cancel order and restore stock
router.post("/:orderId/cancel", protect, async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.userId !== req.user.uid) {
      return res.status(403).json({ error: "Not authorized" });
    }
    if (order.status !== "pending") {
      return res.status(400).json({ error: `Cannot cancel ${order.status} order` });
    }

    // Restore stock
    for (const item of order.items) {
      await Product.updateOne(
        { p_id: item.productId },
        { $inc: { stock: item.quantity } }
      );
    }

    order.status = "cancelled";
    await order.save();

    res.json(order);
  } catch (err) {
    console.error("Cancel order error:", err);
    res.status(500).json({ error: "Failed to cancel order" });
  }
});

// GET /api/orders - User's orders
router.get("/", protect, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user.uid }).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// GET /api/orders/:orderId - Single order detail
router.get("/:orderId", protect, async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.userId !== req.user.uid && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch order" });
  }
});

// GET /api/orders/:orderId/invoice - Generate invoice data
router.get("/:orderId/invoice", protect, async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) return res.status(404).json({ error: "Order not found" });
    if (order.userId !== req.user.uid && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }

    const invoice = {
      invoiceNumber: `INV-${order.orderId}`,
      date: order.paidAt || order.createdAt,
      order: {
        orderId: order.orderId,
        status: order.status,
        items: order.items,
        subtotal: order.subtotal,
        tierDiscount: order.tierDiscount || 0,
        pointsDiscount: order.pointsDiscount || 0,
        couponDiscount: order.couponDiscount || 0,
        couponCode: order.couponCode || "",
        redeemPointsApplied: order.redeemPointsApplied || 0,
        discount: order.discount,
        deliveryFee: order.deliveryFee,
        total: order.total,
        loyaltyTierAtPurchase: order.loyaltyTierAtPurchase,
      },
      customer: {
        email: order.userEmail,
        ...order.shippingAddress.toObject(),
      },
      loyaltyInfo: {
        tierAtPurchase: order.loyaltyTierAtPurchase,
        pointsEarned: order.loyaltyPointsEarned,
      },
      company: {
        name: "CALIDI - Women's Clothing",
        address: "123 Fashion Avenue, Colombo, Sri Lanka",
      },
    };

    res.json(invoice);
  } catch (err) {
    res.status(500).json({ error: "Failed to generate invoice" });
  }
});

// GET /api/orders/loyalty/info - Get loyalty info for checkout preview
router.get("/loyalty/info", protect, async (req, res) => {
  try {
    const user = await User.findOne({ email: req.user.email });
    const tierInfo = getTierInfo(user.loyaltyTier);
    res.json({
      tier: user.loyaltyTier,
      tierInfo,
      points: user.loyaltyPoints,
      totalOrders: user.totalOrders,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch loyalty info" });
  }
});

module.exports = router;
