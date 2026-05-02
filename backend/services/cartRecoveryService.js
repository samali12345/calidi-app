const CartActivity = require("../models/CartActivity");
const Order = require("../models/Order");
const User = require("../models/User");
const { sendAbandonedCartPush } = require("./pushNotifications");

const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

async function runCartRecoverySweep() {
  const now = new Date();
  const staleBefore = new Date(now.getTime() - TWO_HOURS_MS);

  const candidates = await CartActivity.find({
    lastUpdatedAt: { $lt: staleBefore },
    notificationSent: false,
    totalValue: { $gt: 0 },
  });

  let sent = 0;
  let skippedInCheckout = 0;

  for (const activity of candidates) {
    const pendingOrder = await Order.findOne({
      userId: activity.userId,
      status: "pending",
      createdAt: { $gte: staleBefore },
    }).select("_id");

    if (pendingOrder) {
      skippedInCheckout += 1;
      continue;
    }

    const user = await User.findOne({ email: activity.userEmail });
    if (!user?.pushTokens?.length) {
      continue;
    }

    const itemCount = Array.isArray(activity.items)
      ? activity.items.reduce((sum, item) => sum + Number(item?.quantity || 0), 0)
      : 0;

    await sendAbandonedCartPush(user, {
      itemCount,
      totalValue: activity.totalValue,
    });

    activity.notificationSent = true;
    await activity.save();
    sent += 1;
  }

  console.log(
    `[CartRecovery] ${now.toISOString()} scanned=${candidates.length} sent=${sent} skippedInCheckout=${skippedInCheckout}`
  );
}

function startCartRecoveryService() {
  setInterval(() => {
    runCartRecoverySweep().catch((err) => {
      console.error("[CartRecovery] sweep failed:", err.message);
    });
  }, THIRTY_MINUTES_MS);

  console.log("[CartRecovery] service started (every 30 minutes)");
}

module.exports = {
  runCartRecoverySweep,
  startCartRecoveryService,
};
