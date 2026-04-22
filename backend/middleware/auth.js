const admin = require("../config/firebase");
const User = require("../models/User");

const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Not authorized - no token" });
    }

    const idToken = header.split(" ")[1];

    // Verify the Firebase ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);

    // Look up user in MongoDB to get role and loyalty info
    let dbUser = await User.findOne({ email: decodedToken.email });
    if (!dbUser) {
      // Auto-create user document if it doesn't exist yet
      console.log("Auto-creating MongoDB user for:", decodedToken.email);
      dbUser = await User.create({
        email: decodedToken.email,
        password: "firebase-managed",
        role: "customer",
        riderApprovalStatus: "none",
      });
      console.log("MongoDB user created:", dbUser._id);
    } else {
      console.log("Found existing MongoDB user:", dbUser.email);
    }

    // Attach user info to the request
    req.user = {
      _id: dbUser._id,
      email: decodedToken.email,
      uid: decodedToken.uid,
      name: dbUser.name || "",
      mobileNumber: dbUser.mobileNumber || "",
      role: dbUser.role,
      riderApprovalStatus: dbUser.riderApprovalStatus || "none",
      isAvailable: dbUser.isAvailable,
      vehicleType: dbUser.vehicleType || "bike",
      loyaltyTier: dbUser.loyaltyTier,
      loyaltyPoints: dbUser.loyaltyPoints,
      totalOrders: dbUser.totalOrders,
      pointsEarnedAt: dbUser.pointsEarnedAt || null,
      pointsExpiryWarnedAt: dbUser.pointsExpiryWarnedAt || null,
      pointsExpiryWarnedFor: dbUser.pointsExpiryWarnedFor || null,
    };

    next();
  } catch (error) {
    console.error("Firebase auth error:", error.message);
    return res.status(401).json({ error: "Not authorized - invalid token" });
  }
};

module.exports = { protect };
