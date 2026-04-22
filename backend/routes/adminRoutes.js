const express = require("express");
const router = express.Router();
const multer = require("multer");
const { protect } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/admin");
const admin = require("../controllers/adminController");

// Multer config for image uploads (memory storage for GridFS)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// All admin routes require auth + admin role
router.use(protect, requireAdmin);

// Dashboard
router.get("/dashboard/stats", admin.getDashboardStats);
router.get("/dashboard/sales", admin.getSalesData);
router.get("/settings/double-points", admin.getDoublePointsSetting);
router.put("/settings/double-points", admin.updateDoublePointsSetting);

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
