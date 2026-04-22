const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const User = require("../models/User");
const { getTierProgress } = require("../services/loyaltyService");

function normalizeName(value = "") {
  return String(value).trim().replace(/\s+/g, " ");
}

function normalizeMobile(value = "") {
  return String(value).trim().replace(/[\s-]/g, "");
}

function isValidName(name) {
  return name.length >= 2 && name.length <= 60;
}

function isValidMobile(mobile) {
  return /^\+?\d{7,15}$/.test(mobile);
}

function isValidEmail(email = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

function normalizeVehicleType(value = "") {
  const v = String(value || "").trim().toLowerCase();
  if (["bike", "threewheel", "van"].includes(v)) return v;
  return "";
}

function buildUserPayload(dbUser, authUser) {
  const loyaltyTier = dbUser.loyaltyTier || "none";
  const totalOrders = Number(dbUser.totalOrders || 0);
  const progress = getTierProgress(totalOrders, loyaltyTier);

  return {
    id: authUser.uid,
    email: dbUser.email,
    name: dbUser.name || "",
    mobileNumber: dbUser.mobileNumber || "",
    role: dbUser.role,
    riderApprovalStatus: dbUser.riderApprovalStatus || "none",
    isAvailable: !!dbUser.isAvailable,
    vehicleType: dbUser.vehicleType || "bike",
    loyaltyTier,
    loyaltyPoints: Number(dbUser.loyaltyPoints || 0),
    totalOrders,
    nextTier: progress.nextTier,
    nextTierThreshold: progress.nextTierThreshold,
    ordersToNextTier: progress.ordersToNextTier,
    nextTierDiscount: progress.nextTierDiscount,
    currentTierDiscount: progress.currentTierDiscount,
    currentTierMin: progress.currentTierMin,
    progressPercent: progress.progressPercent,
  };
}

// POST /api/auth/validate-signup - frontend pre-check before Firebase signup
router.post("/validate-signup", async (req, res) => {
  const name = normalizeName(req.body?.name);
  const mobileNumber = normalizeMobile(req.body?.mobileNumber);
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const confirmPassword = String(req.body?.confirmPassword || "");

  if (!isValidName(name)) {
    return res.status(400).json({ error: "Name must be between 2 and 60 characters" });
  }

  if (!isValidMobile(mobileNumber)) {
    return res.status(400).json({ error: "Invalid mobile number. Use 7 to 15 digits, optional leading +" });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Invalid email address" });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: "Password must be at least 6 characters" });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ error: "Passwords do not match" });
  }

  return res.json({ ok: true });
});

// GET /api/auth/me - returns the current authenticated user info
router.get("/me", protect, (req, res) => {
  const isApprovedRider =
    req.user.role === "rider" && req.user.riderApprovalStatus === "approved";
  res.json({
    isRider: isApprovedRider,
    riderApprovalStatus: req.user.riderApprovalStatus || "none",
    user: buildUserPayload(req.user, req.user),
  });
});

// POST /api/auth/profile - set user profile fields after Firebase signup
router.post("/profile", protect, async (req, res) => {
  try {
    const name = normalizeName(req.body?.name);
    const mobileNumber = normalizeMobile(req.body?.mobileNumber);
    const registerAsRider = !!req.body?.registerAsRider;
    const vehicleType = normalizeVehicleType(req.body?.vehicleType);

    if (!isValidName(name)) {
      return res.status(400).json({ error: "Name must be between 2 and 60 characters" });
    }

    if (!isValidMobile(mobileNumber)) {
      return res.status(400).json({ error: "Invalid mobile number. Use 7 to 15 digits, optional leading +" });
    }

    const updates = { name, mobileNumber };
    if (registerAsRider) {
      updates.role = "rider";
      updates.riderApprovalStatus = "pending";
      updates.riderAppliedAt = new Date();
      updates.isAvailable = false;
      if (vehicleType) {
        updates.vehicleType = vehicleType;
      }
    }

    const updatedUser = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    const isApprovedRider =
      updatedUser.role === "rider" &&
      updatedUser.riderApprovalStatus === "approved";
    return res.json({
      message: "Profile updated",
      isRider: isApprovedRider,
      riderApprovalStatus: updatedUser.riderApprovalStatus || "none",
      user: buildUserPayload(updatedUser, req.user),
    });
  } catch (error) {
    console.error("Profile update error:", error.message);
    return res.status(500).json({ error: "Failed to update profile" });
  }
});

// POST /api/auth/push-token - register browser push token for current user
router.post("/push-token", protect, async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();
    const userAgent = String(req.body?.userAgent || "").trim();

    if (!token || token.length < 20) {
      return res.status(400).json({ error: "Invalid push token" });
    }

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (!Array.isArray(user.pushTokens)) user.pushTokens = [];
    const existing = user.pushTokens.find((pt) => pt.token === token);

    if (existing) {
      existing.lastSeenAt = new Date();
      if (userAgent) existing.userAgent = userAgent;
    } else {
      user.pushTokens.push({
        token,
        userAgent,
        createdAt: new Date(),
        lastSeenAt: new Date(),
      });
    }

    await user.save();
    return res.json({ message: "Push token registered" });
  } catch (err) {
    console.error("Push token register error:", err.message);
    return res.status(500).json({ error: "Failed to register push token" });
  }
});

// DELETE /api/auth/push-token - unregister browser push token
router.delete("/push-token", protect, async (req, res) => {
  try {
    const token = String(req.body?.token || "").trim();
    if (!token) return res.status(400).json({ error: "Token is required" });

    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.pushTokens = (user.pushTokens || []).filter((pt) => pt.token !== token);
    await user.save();
    return res.json({ message: "Push token removed" });
  } catch (err) {
    console.error("Push token remove error:", err.message);
    return res.status(500).json({ error: "Failed to remove push token" });
  }
});

module.exports = router;
