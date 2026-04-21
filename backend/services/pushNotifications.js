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

module.exports = {
  sendDeliveryStatusPush,
};

