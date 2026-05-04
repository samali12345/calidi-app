const jwt = require('jsonwebtoken');
const User = require('../models/User');

// JWT-based protection for mobile app (does not use Firebase)
const protectJWT = async (req, res, next) => {
  try {
    let token;
    const header = req.headers.authorization;
    
    if (header && header.startsWith('Bearer ')) {
      token = header.split(' ')[1];
    } else if (req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ error: 'Not authorized - no token' });
    }
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: 'Not authorized - invalid or expired token' });
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'Not authorized - user not found' });
    }

    req.user = {
      _id: user._id,
      email: user.email,
      uid: user._id.toString(), // fallback uid
      name: user.name || '',
      mobileNumber: user.mobileNumber || '',
      role: user.role,
      riderApprovalStatus: user.riderApprovalStatus || 'none',
      isAvailable: user.isAvailable,
      vehicleType: user.vehicleType || 'bike',
      loyaltyTier: user.loyaltyTier,
      loyaltyPoints: user.loyaltyPoints,
      totalOrders: user.totalOrders,
      pointsEarnedAt: user.pointsEarnedAt || null,
    };

    next();
  } catch (error) {
    console.error('JWT auth error:', error.message);
    return res.status(401).json({ error: 'Not authorized' });
  }
};

module.exports = { protectJWT };
