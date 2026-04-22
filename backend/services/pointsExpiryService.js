const User = require("../models/User");
const { sendLoyaltyPointsExpiryPush } = require("./pushNotifications");

const DAY_MS = 24 * 60 * 60 * 1000;

function getExpiryMonths() {
  const configured = Number(process.env.LOYALTY_POINTS_EXPIRY_MONTHS || 6);
  return Number.isInteger(configured) && configured > 0 ? configured : 6;
}

function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function getPointsExpireAt(pointsEarnedAt, months = getExpiryMonths()) {
  if (!pointsEarnedAt) return null;
  return addMonths(pointsEarnedAt, months);
}

function getPointsExpiryInfo(user, now = new Date()) {
  const points = Number(user?.loyaltyPoints || 0);
  if (points <= 0 || !user?.pointsEarnedAt) {
    return {
      pointsExpireAt: null,
      daysUntilExpiry: null,
      loyaltyPoints: points,
      expiryMonths: getExpiryMonths(),
    };
  }

  const pointsExpireAt = getPointsExpireAt(user.pointsEarnedAt);
  const daysUntilExpiry = Math.ceil((pointsExpireAt.getTime() - now.getTime()) / DAY_MS);

  return {
    pointsExpireAt: pointsExpireAt.toISOString(),
    daysUntilExpiry,
    loyaltyPoints: points,
    expiryMonths: getExpiryMonths(),
  };
}

async function runPointsExpirySweep() {
  const now = new Date();
  const expiryMonths = getExpiryMonths();
  const expireBefore = addMonths(now, -expiryMonths);

  const expiredResult = await User.updateMany(
    {
      loyaltyPoints: { $gt: 0 },
      pointsEarnedAt: { $ne: null, $lt: expireBefore },
    },
    {
      $set: {
        loyaltyPoints: 0,
        pointsExpiryWarnedAt: null,
        pointsExpiryWarnedFor: null,
      },
    }
  );

  const usersForWarning = await User.find({
    loyaltyPoints: { $gt: 0 },
    pointsEarnedAt: { $ne: null },
  });

  let warnedCount = 0;
  for (const user of usersForWarning) {
    const pointsExpireAt = getPointsExpireAt(user.pointsEarnedAt, expiryMonths);
    if (!pointsExpireAt) continue;
    const daysUntilExpiry = Math.ceil((pointsExpireAt.getTime() - now.getTime()) / DAY_MS);

    const alreadyWarnedForSameWindow =
      user.pointsExpiryWarnedFor &&
      new Date(user.pointsExpiryWarnedFor).getTime() === pointsExpireAt.getTime();

    if (daysUntilExpiry === 7 && !alreadyWarnedForSameWindow) {
      await sendLoyaltyPointsExpiryPush(user, {
        loyaltyPoints: user.loyaltyPoints,
        daysUntilExpiry,
        pointsExpireAt,
      });
      user.pointsExpiryWarnedAt = now;
      user.pointsExpiryWarnedFor = pointsExpireAt;
      await user.save();
      warnedCount += 1;
    }
  }

  console.log(
    `[PointsExpiry] ${new Date().toISOString()} expired=${expiredResult.modifiedCount} warned=${warnedCount}`
  );
}

function msUntilNext9am(now = new Date()) {
  const next = new Date(now);
  next.setHours(9, 0, 0, 0);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime() - now.getTime();
}

function startPointsExpiryService() {
  const schedule = () => {
    const waitMs = msUntilNext9am();
    setTimeout(async () => {
      try {
        await runPointsExpirySweep();
      } catch (err) {
        console.error("[PointsExpiry] sweep failed:", err.message);
      } finally {
        schedule();
      }
    }, waitMs);
  };

  schedule();
  console.log(
    `[PointsExpiry] service started (daily at 09:00 local, expiry=${getExpiryMonths()} months)`
  );
}

module.exports = {
  getExpiryMonths,
  getPointsExpireAt,
  getPointsExpiryInfo,
  runPointsExpirySweep,
  startPointsExpiryService,
};
