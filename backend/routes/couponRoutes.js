const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { findAndValidateCoupon } = require("../services/couponService");

// POST /api/coupons/validate
router.post("/validate", protect, async (req, res) => {
  try {
    const code = req.body?.code;
    const orderTotal = Number(req.body?.orderTotal || 0);
    if (!(orderTotal > 0)) {
      return res.status(400).json({ valid: false, error: "orderTotal must be greater than 0" });
    }

    const result = await findAndValidateCoupon({
      code,
      userId: req.user.uid,
      orderTotal,
    });

    if (!result.valid || !result.coupon) {
      return res.status(400).json({
        valid: false,
        error: result.reason || "Invalid coupon",
      });
    }

    return res.json({
      valid: true,
      code: result.coupon.code,
      discountType: result.coupon.discountType,
      discountValue: result.coupon.discountValue,
      discountAmount: result.discountAmount,
    });
  } catch (err) {
    return res.status(500).json({ valid: false, error: "Failed to validate coupon" });
  }
});

module.exports = router;
