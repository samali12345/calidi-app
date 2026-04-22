const express = require("express");
const router = express.Router();
const { getDoublePointsStatus } = require("../services/doublePointsService");

// GET /api/settings/double-points
router.get("/double-points", async (_req, res) => {
  try {
    const status = await getDoublePointsStatus();
    if (status.active) {
      return res.json({ active: true, endsAt: status.endsAt });
    }
    return res.json({ active: false });
  } catch (err) {
    return res.status(500).json({ active: false, error: "Failed to fetch double points status" });
  }
});

module.exports = router;
