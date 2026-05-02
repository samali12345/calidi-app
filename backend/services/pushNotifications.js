const admin = require("../config/firebase");
const User = require("../models/User");

const STATUS_LABELS = {
  pending_pickup: "Pending Pickup",
  in_transit: "In Transit",
  delivered: "Delivered",
  failed: "Delivery Failed",
  returned: "Returned",
};

function getStatusLabel(status) {
  return STATUS_LABELS[status] || "Delivery Updated";
}

function isTokenError(errorCode = "") {
  return (
    errorCode === "messaging/registration-token-not-registered" ||
    errorCode === "messaging/invalid-registration-token"
  );
}

async function sendDeliveryStatusPush(delivery) {
  if (!delivery?.userEmail) return;

  const user = await User.findOne({ email: delivery.userEmail });
  if (!user?.pushTokens?.length) return;

  const tokens = user.pushTokens.map((t) => t.token).filter(Boolean);
  if (!tokens.length) return;

  const statusLabel = getStatusLabel(delivery.status);

  const message = {
    tokens,
    notification: {
      title: "CALIDI Delivery Update",
      body: `${statusLabel} - ${delivery.deliveryId}`,
    },
    data: {
      type: "delivery_update",
      deliveryId: delivery.deliveryId,
      orderId: delivery.orderId || "",
      status: delivery.status || "",
    },
    webpush: {
      fcmOptions: {
        link: `http://localhost:8080/delivery/${delivery.deliveryId}`,
      },
    },
  };

  const response = await admin.messaging().sendEachForMulticast(message);

  const invalidTokens = [];
  response.responses.forEach((r, idx) => {
    if (!r.success && isTokenError(r.error?.code)) {
      invalidTokens.push(tokens[idx]);
    }
  });

  if (invalidTokens.length) {
    user.pushTokens = user.pushTokens.filter((pt) => !invalidTokens.includes(pt.token));
    await user.save();
  }
}

async function sendLoyaltyPointsExpiryPush(user, { loyaltyPoints, daysUntilExpiry, pointsExpireAt }) {
  if (!user?.pushTokens?.length) return;

  const tokens = user.pushTokens.map((t) => t.token).filter(Boolean);
  if (!tokens.length) return;

  const message = {
    tokens,
    notification: {
      title: "CALIDI Loyalty Reminder",
      body: `Your ${loyaltyPoints} points expire in ${daysUntilExpiry} days - shop now to keep them!`,
    },
    data: {
      type: "loyalty_points_expiry",
      loyaltyPoints: String(loyaltyPoints || 0),
      daysUntilExpiry: String(daysUntilExpiry || 0),
      pointsExpireAt: pointsExpireAt ? new Date(pointsExpireAt).toISOString() : "",
    },
    webpush: {
      fcmOptions: {
        link: "http://localhost:8080/shop",
      },
    },
  };

  const response = await admin.messaging().sendEachForMulticast(message);

  const invalidTokens = [];
  response.responses.forEach((r, idx) => {
    if (!r.success && isTokenError(r.error?.code)) {
      invalidTokens.push(tokens[idx]);
    }
  });

  if (invalidTokens.length) {
    user.pushTokens = user.pushTokens.filter((pt) => !invalidTokens.includes(pt.token));
    await user.save();
  }
}

async function sendAbandonedCartPush(user, { itemCount, totalValue }) {
  if (!user?.pushTokens?.length) return;

  const tokens = user.pushTokens.map((t) => t.token).filter(Boolean);
  if (!tokens.length) return;

  const message = {
    tokens,
    notification: {
      title: "Your Calidi cart is waiting",
      body: `You have ${itemCount} items worth LKR ${Number(totalValue || 0).toLocaleString()} in your bag. Complete your order!`,
    },
    data: {
      type: "abandoned_cart_recovery",
      itemCount: String(itemCount || 0),
      totalValue: String(totalValue || 0),
    },
    webpush: {
      fcmOptions: {
        link: "http://localhost:8080/checkout",
      },
    },
  };

  const response = await admin.messaging().sendEachForMulticast(message);

  const invalidTokens = [];
  response.responses.forEach((r, idx) => {
    if (!r.success && isTokenError(r.error?.code)) {
      invalidTokens.push(tokens[idx]);
    }
  });

  if (invalidTokens.length) {
    user.pushTokens = user.pushTokens.filter((pt) => !invalidTokens.includes(pt.token));
    await user.save();
  }
}

module.exports = {
  sendDeliveryStatusPush,
  sendLoyaltyPointsExpiryPush,
  sendAbandonedCartPush,
};
