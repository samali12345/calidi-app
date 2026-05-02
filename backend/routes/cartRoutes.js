const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const CartActivity = require("../models/CartActivity");

// POST /api/cart/activity
router.post("/activity", protect, async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const totalValue = Number(req.body?.totalValue || 0);

    if (items.length === 0 || totalValue <= 0) {
      await CartActivity.deleteOne({ userId: req.user.uid });
      return res.json({ message: "Cart activity cleared" });
    }

    await CartActivity.findOneAndUpdate(
      { userId: req.user.uid },
      {
        $set: {
          userEmail: String(req.user.email || "").toLowerCase(),
          items,
          totalValue,
          lastUpdatedAt: new Date(),
          notificationSent: false,
        },
      },
      { upsert: true, new: true }
    );

    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: "Failed to record cart activity" });
  }
});

module.exports = router;
