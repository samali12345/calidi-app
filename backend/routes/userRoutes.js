const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { getPointsExpiryInfo } = require("../services/pointsExpiryService");

// GET /api/user/points-expiry
router.get("/points-expiry", protect, async (req, res) => {
  try {
    const info = getPointsExpiryInfo(req.user, new Date());
    return res.json(info);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch points expiry info" });
  }
});

module.exports = router;
