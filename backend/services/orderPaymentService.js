const Order = require("../models/Order");
const User = require("../models/User");
const Delivery = require("../models/Delivery");
const { calculateTier } = require("./loyaltyService");

function generateDeliveryId() {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `DEL-${ts}-${rand}`;
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

  // Loyalty updates are tied to first successful payment only.
  const user = await User.findOne({ email: order.userEmail });
  if (user) {
    user.totalOrders += 1;
    user.loyaltyPoints += order.loyaltyPointsEarned;
    user.loyaltyTier = calculateTier(user.totalOrders);
    await user.save();
  }

  return { order, delivery, alreadyPaid: false };
}

module.exports = {
  finalizeOrderAsPaid,
};

