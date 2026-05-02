const User = require("../models/User");
const Delivery = require("../models/Delivery");
const Coupon = require("../models/Coupon");
const { calculateTier } = require("./loyaltyService");

function generateDeliveryId() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `DEL-${ts}-${rand}`;
}

async function settleLoyaltyForPaidOrder(order) {
  if (!order || order.loyaltyProcessed) return;
  if (order.pointsRedemptionStatus === "deducted" || order.pointsRedemptionStatus === "refunded") {
    order.loyaltyProcessed = true;
    return;
  }

  const redeemPoints = Math.max(0, Number(order.redeemPointsApplied || 0));
  const pointsEarned = Math.max(0, Number(order.loyaltyPointsEarned || 0));
  const netPoints = pointsEarned - redeemPoints;

  const update = {
    $inc: {
      totalOrders: 1,
      loyaltyPoints: netPoints,
    },
  };
  const filter = { email: order.userEmail };

  if (redeemPoints > 0 && order.pointsRedemptionStatus === "pending") {
    filter.loyaltyPoints = { $gte: redeemPoints };
  }

  const user = await User.findOneAndUpdate(filter, update, { new: true });
  if (!user) {
    throw new Error("Insufficient loyalty points to redeem for this order");
  }

  user.loyaltyTier = calculateTier(user.totalOrders);
  if (pointsEarned > 0) {
    user.pointsEarnedAt = new Date();
    user.pointsExpiryWarnedAt = null;
    user.pointsExpiryWarnedFor = null;
  }
  await user.save();

  if (redeemPoints > 0) {
    order.pointsRedemptionStatus = "deducted";
  } else {
    order.pointsRedemptionStatus = "none";
  }
  order.loyaltyProcessed = true;
}

async function settleCouponForPaidOrder(order) {
  if (!order) return;
  if (!order.couponCode || Number(order.couponDiscount || 0) <= 0) {
    order.couponUsageStatus = "none";
    return;
  }
  if (order.couponUsageStatus === "applied" || order.couponUsageStatus === "refunded") {
    return;
  }

  const now = new Date();
  const couponFilter = {
    code: String(order.couponCode).toUpperCase(),
    isActive: true,
    usedBy: { $ne: order.userId },
    $and: [
      {
        $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gte: now } }],
      },
      {
        $or: [
          { maxUses: null },
          { maxUses: { $exists: false } },
          { $expr: { $lt: ["$usedCount", "$maxUses"] } },
        ],
      },
    ],
  };

  if (order.couponId) {
    couponFilter._id = order.couponId;
  }

  const coupon = await Coupon.findOneAndUpdate(
    couponFilter,
    {
      $inc: { usedCount: 1 },
      $addToSet: { usedBy: order.userId },
    },
    { new: true }
  );

  if (!coupon) {
    throw new Error("Coupon can no longer be applied to this order");
  }

  order.couponId = coupon._id;
  order.couponCode = coupon.code;
  order.couponUsageStatus = "applied";
}

async function refundRedeemedPointsForOrder(order) {
  if (!order) return null;
  if (order.pointsRedemptionStatus !== "deducted") return null;

  const redeemPoints = Math.max(0, Number(order.redeemPointsApplied || 0));
  if (redeemPoints <= 0) return null;

  const user = await User.findOneAndUpdate(
    { email: order.userEmail },
    { $inc: { loyaltyPoints: redeemPoints } },
    { new: true }
  );

  if (user) {
    user.loyaltyTier = calculateTier(user.totalOrders);
    await user.save();
  }

  order.pointsRedemptionStatus = "refunded";
  await order.save();

  return user;
}

async function refundCouponForOrder(order) {
  if (!order) return null;
  if (order.couponUsageStatus !== "applied") return null;
  if (!order.couponCode || Number(order.couponDiscount || 0) <= 0) return null;

  const filter = {
    code: String(order.couponCode).toUpperCase(),
    usedBy: order.userId,
  };

  if (order.couponId) {
    filter._id = order.couponId;
  }

  const coupon = await Coupon.findOneAndUpdate(
    filter,
    {
      $pull: { usedBy: order.userId },
      $inc: { usedCount: -1 },
    },
    { new: true }
  );

  if (coupon && coupon.usedCount < 0) {
    coupon.usedCount = 0;
    await coupon.save();
  }

  order.couponUsageStatus = "refunded";
  await order.save();
  return coupon;
}

async function finalizeOrderAsPaid(order, payment = {}) {
  const {
    paymentMethod = "simulated",
    stripeSessionId = null,
    stripePaymentIntentId = null,
    paidAt = new Date(),
  } = payment;

  if (!order) {
    throw new Error("Order not found");
  }

  if (order.status === "paid") {
    if (order.couponUsageStatus === "pending") {
      await settleCouponForPaidOrder(order);
      await order.save();
    }
    if (!order.loyaltyProcessed) {
      await settleLoyaltyForPaidOrder(order);
      await order.save();
    }
    const existingDelivery = order.deliveryId
      ? await Delivery.findOne({ deliveryId: order.deliveryId })
      : null;
    return { order, delivery: existingDelivery, alreadyPaid: true };
  }

  if (order.status !== "pending") {
    throw new Error(`Cannot pay for ${order.status} order`);
  }

  if (new Date(order.expiresAt) < new Date()) {
    throw new Error("Order has expired");
  }

  order.status = "paid";
  order.paidAt = paidAt;
  order.paymentMethod = paymentMethod;
  if (stripeSessionId) order.stripeSessionId = stripeSessionId;
  if (stripePaymentIntentId) order.stripePaymentIntentId = String(stripePaymentIntentId);

  let delivery = null;
  if (!order.deliveryId) {
    const dd = order.deliveryDetails || {};
    const deliveryId = generateDeliveryId();

    delivery = await Delivery.create({
      deliveryId,
      orderId: order.orderId,
      userId: order.userId,
      userEmail: order.userEmail,
      recipientName: dd.recipientName || order.shippingAddress.fullName,
      contactNumber: dd.contactNumber || "",
      deliveryAddress: {
        street: order.shippingAddress.street,
        city: order.shippingAddress.city,
        state: order.shippingAddress.state,
        zip: order.shippingAddress.zip,
        country: order.shippingAddress.country,
      },
      deliveryNotes: dd.deliveryNotes || "",
      deliveryMethod: dd.deliveryMethod || "standard",
      deliveryFee: order.deliveryFee,
      scheduledDate: dd.scheduledDate || null,
      scheduledTimeSlot: dd.scheduledTimeSlot || "any",
      status: "pending_pickup",
      statusHistory: [
        { status: "pending_pickup", timestamp: new Date(), note: "Order confirmed, awaiting pickup" },
      ],
      itemCount: order.items.reduce((s, i) => s + i.quantity, 0),
      orderTotal: order.total,
    });
    order.deliveryId = deliveryId;
  } else {
    delivery = await Delivery.findOne({ deliveryId: order.deliveryId });
  }

  await order.save();

  await settleCouponForPaidOrder(order);
  await order.save();

  // Loyalty updates are tied to first successful payment only.
  await settleLoyaltyForPaidOrder(order);
  await order.save();

  return { order, delivery, alreadyPaid: false };
}

module.exports = {
  finalizeOrderAsPaid,
  refundRedeemedPointsForOrder,
  refundCouponForOrder,
};
