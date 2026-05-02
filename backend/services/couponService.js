const Coupon = require("../models/Coupon");

function normalizeCouponCode(code = "") {
  return String(code || "").trim().toUpperCase();
}

function computeCouponDiscountAmount(coupon, orderTotal) {
  const base = Math.max(0, Number(orderTotal) || 0);
  if (!coupon || base <= 0) return 0;

  if (coupon.discountType === "percentage") {
    return Math.min(base, Math.round((base * Number(coupon.discountValue || 0)) / 100));
  }

  return Math.min(base, Math.round(Number(coupon.discountValue || 0)));
}

function validateCouponForOrder({ coupon, userId, orderTotal }) {
  if (!coupon) return { valid: false, reason: "Coupon not found" };

  const amount = Math.max(0, Number(orderTotal) || 0);
  const now = new Date();

  if (!coupon.isActive) return { valid: false, reason: "Coupon is inactive" };
  if (coupon.expiresAt && new Date(coupon.expiresAt) < now) {
    return { valid: false, reason: "Coupon has expired" };
  }
  if (Number(coupon.maxUses) > 0 && Number(coupon.usedCount || 0) >= Number(coupon.maxUses)) {
    return { valid: false, reason: "Coupon usage limit reached" };
  }
  if (amount < Number(coupon.minOrderValue || 0)) {
    return {
      valid: false,
      reason: `Minimum order value is LKR ${Number(coupon.minOrderValue || 0).toLocaleString()}`,
    };
  }
  if (userId && Array.isArray(coupon.usedBy) && coupon.usedBy.includes(userId)) {
    return { valid: false, reason: "You have already used this coupon" };
  }

  const discountAmount = computeCouponDiscountAmount(coupon, amount);
  return {
    valid: true,
    discountAmount,
  };
}

async function findAndValidateCoupon({ code, userId, orderTotal }) {
  const normalizedCode = normalizeCouponCode(code);
  if (!normalizedCode) return { valid: false, reason: "Coupon code is required" };

  const coupon = await Coupon.findOne({ code: normalizedCode });
  const validation = validateCouponForOrder({ coupon, userId, orderTotal });
  return {
    ...validation,
    coupon: validation.valid ? coupon : null,
    code: normalizedCode,
  };
}

module.exports = {
  normalizeCouponCode,
  computeCouponDiscountAmount,
  validateCouponForOrder,
  findAndValidateCoupon,
};
