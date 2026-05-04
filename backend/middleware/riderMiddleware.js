const requireRider = (req, res, next) => {
  if (
    !req.user ||
    req.user.role !== "rider" ||
    req.user.riderApprovalStatus !== "approved"
  ) {
    return res.status(403).json({ error: "Access denied - rider only" });
  }
  next();
};

module.exports = { requireRider };
