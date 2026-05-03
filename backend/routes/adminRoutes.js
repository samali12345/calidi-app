const express = require("express");
const router = express.Router();
const multer = require("multer");
const { protect } = require("../middleware/auth");
const { protectJWT } = require("../middleware/authJWT");
const { requireAdmin } = require("../middleware/admin");
const admin = require("../controllers/adminController");
const Refund = require("../models/Refund");
const Order = require("../models/Order");

// Multer config for image uploads
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

/**
 * Custom Middleware to allow both Firebase (protect) and Mobile JWT (protectJWT)
 * This ensures the admin panel works for both web admin and mobile/expo-web admin
 */
const flexibleProtect = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    // Try JWT first (Mobile/Expo Web)
    return protectJWT(req, res, next);
  }
  // Fallback to Firebase (Web Dashboard)
  return protect(req, res, next);
};

// All admin routes require auth + admin role
router.use(flexibleProtect, requireAdmin);

// Refund Management (Added here for consolidation)
router.get("/refunds", async (req, res) => {
  try {
    const refunds = await Refund.find().sort({ createdAt: -1 });
    res.json(refunds);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch refunds" });
  }
});

router.put("/refunds/:id", async (req, res) => {
  try {
    const { status, adminComment } = req.body;
    const refund = await Refund.findById(req.params.id);
    if (!refund) return res.status(404).json({ error: "Refund not found" });

    refund.status = status;
    if (adminComment !== undefined) refund.adminComment = adminComment;
    await refund.save();

    if (status === "approved") {
      await Order.findOneAndUpdate({ orderId: refund.orderId }, { status: "refunded" });
    }
    res.json(refund);
  } catch (err) {
    res.status(500).json({ error: "Failed to update refund" });
  }
});

// Original Dashboard Routes
router.get("/dashboard/stats", admin.getDashboardStats);
router.get("/dashboard/sales", admin.getSalesData);
router.get("/settings/double-points", admin.getDoublePointsSetting);
router.put("/settings/double-points", admin.updateDoublePointsSetting);
router.get("/stripe/overview", admin.getStripeOverview);

// Products
router.get("/products", admin.getProducts);
router.get("/products/low-stock", admin.getLowStockProducts);
router.post("/products", upload.single("image"), admin.createProduct);
router.post("/products/restock", admin.restockProducts);
router.put("/products/:p_id", admin.updateProduct);
router.put("/products/:p_id/restock", admin.restockSingleProduct);
router.delete("/products/:p_id", admin.deleteProduct);

// Orders
router.get("/orders", admin.getOrders);
router.put("/orders/:orderId/status", admin.updateOrderStatus);

// Deliveries
router.get("/deliveries", admin.getDeliveries);
router.get("/deliveries/stats", admin.getDeliveryStats);
router.put("/deliveries/:deliveryId/status", admin.updateDeliveryStatus);
router.put("/deliveries/:deliveryId/live", admin.updateDeliveryLive);
router.post("/deliveries/:deliveryId/assign-rider", admin.assignRiderToDelivery);

// Riders
router.get("/riders", admin.getAllRiders);
router.put("/riders/:riderId/approval", admin.updateRiderApproval);

// Customers
router.get("/customers", admin.getCustomers);

// Coupons
router.post("/coupons", admin.createCoupon);
router.get("/coupons", admin.getCoupons);
router.put("/coupons/:id", admin.updateCoupon);
router.delete("/coupons/:id", admin.deleteCoupon);

// Reports
router.get("/reports/sales", admin.getSalesReport);
router.get("/reports/stock", admin.getStockReport);

module.exports = router;
