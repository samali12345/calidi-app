const Product = require("../models/Product");
const Order = require("../models/Order");
const User = require("../models/User");
const Delivery = require("../models/Delivery");
const mongoose = require("mongoose");
const { broadcastDeliveryUpdate } = require("../services/deliveryRealtime");
const { sendDeliveryStatusPush } = require("../services/pushNotifications");
const { indexSingleProduct } = require("../services/recommendationIndexer");
const {
  finalizeOrderAsPaid,
  refundRedeemedPointsForOrder,
  refundCouponForOrder,
} = require("../services/orderPaymentService");
const Coupon = require("../models/Coupon");
const { upsertDoublePointsSetting, getDoublePointsStatus } = require("../services/doublePointsService");
const Stripe = require("stripe");

const TERMINAL_DELIVERY_STATUSES = ["delivered", "failed", "returned"];
const PRODUCT_HAS_IMAGE_FILTER = {
  $or: [
    { image_id: { $exists: true, $ne: null } },
    { img: { $exists: true, $ne: "" } },
  ],
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchJsonWithRetry = async (url, options = {}, attempts = 3) => {
  let lastError = null;
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return await response.json();
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (err) {
      lastError = err;
    }

    if (i < attempts - 1) {
      await wait(250 * (i + 1));
    }
  }

  throw lastError || new Error("Request failed");
};

const getStripeClient = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY);
};

const geocodeAddress = async (query) => {
  const q = typeof query === "string" ? query.trim() : "";
  if (!q) return null;

  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`;
  let data = null;
  try {
    data = await fetchJsonWithRetry(
      url,
      {
        headers: {
          "User-Agent": "calidi-delivery-tracker/1.0",
          Accept: "application/json",
        },
      },
      3
    );
  } catch {
    return null;
  }

  if (!Array.isArray(data) || data.length === 0) return null;

  const lat = Number(data[0].lat);
  const lng = Number(data[0].lon);

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return { lat, lng };
};

// GET /api/admin/dashboard/stats
exports.getDashboardStats = async (req, res) => {
  try {
    const [totalProducts, lowStockCount, orderStats, totalOrders] = await Promise.all([
      Product.countDocuments(PRODUCT_HAS_IMAGE_FILTER),
      Product.countDocuments({
        ...PRODUCT_HAS_IMAGE_FILTER,
        $expr: { $lte: ["$stock", "$lowStockThreshold"] },
      }),
      Order.aggregate([
        { $match: { status: "paid" } },
        { $group: { _id: null, totalRevenue: { $sum: "$total" } } },
      ]),
      Order.countDocuments(),
    ]);

    res.json({
      totalProducts,
      lowStockCount,
      totalRevenue: orderStats[0]?.totalRevenue || 0,
      totalOrders,
    });
  } catch (err) {
    console.error("Dashboard stats error:", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
};

// GET /api/admin/dashboard/sales?period=30
exports.getSalesData = async (req, res) => {
  try {
    const days = parseInt(req.query.period) || 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const salesData = await Order.aggregate([
      { $match: { status: "paid", paidAt: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$paidAt" } },
          revenue: { $sum: "$total" },
          orderCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { date: "$_id", revenue: 1, orderCount: 1, _id: 0 } },
    ]);

    res.json(salesData);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch sales data" });
  }
};

// GET /api/admin/products
exports.getProducts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search || "";
    const category = req.query.category || "";

    const filter = { ...PRODUCT_HAS_IMAGE_FILTER };
    if (search) filter.name = { $regex: search, $options: "i" };
    if (category) filter.category = category;

    const [products, total] = await Promise.all([
      Product.find(filter)
        .sort({ p_id: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Product.countDocuments(filter),
    ]);

    res.json({ products, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch products" });
  }
};

// POST /api/admin/products
exports.createProduct = async (req, res) => {
  try {
    const { name, description, brand, colour, price, category, stock, lowStockThreshold } = req.body;

    if (!name || !price) {
      return res.status(400).json({ error: "Name and price are required" });
    }
    if (price < 0) {
      return res.status(400).json({ error: "Price cannot be negative" });
    }
    if (stock !== undefined && stock < 0) {
      return res.status(400).json({ error: "Stock cannot be negative" });
    }

    // Generate next p_id
    const lastProduct = await Product.findOne().sort({ p_id: -1 });
    const nextPId = (lastProduct?.p_id || 0) + 1;

    let imageId = null;

    // Handle image upload via GridFS
    if (req.file) {
      const db = mongoose.connection.db;
      const bucket = new mongoose.mongo.GridFSBucket(db);
      const uploadStream = bucket.openUploadStream(req.file.originalname, {
        contentType: req.file.mimetype,
      });
      uploadStream.end(req.file.buffer);
      imageId = uploadStream.id;
    }

    const product = await Product.create({
      p_id: nextPId,
      name,
      description: description || "",
      brand: brand || "",
      colour: colour || "",
      price: parseFloat(price),
      category: category || "",
      stock: parseInt(stock) || 50,
      lowStockThreshold: parseInt(lowStockThreshold) || 10,
      image_id: imageId,
      aiIndexed: false,
      aiIndexedAt: null,
      aiIndexError: "",
    });

    // Non-blocking indexing call so newly created products become recommendable.
    indexSingleProduct(product).catch((err) => {
      console.error(`Post-create recommendation indexing error for p_id=${product.p_id}:`, err.message);
    });

    res.status(201).json(product);
  } catch (err) {
    console.error("Create product error:", err);
    res.status(500).json({ error: "Failed to create product" });
  }
};

// PUT /api/admin/products/:p_id
exports.updateProduct = async (req, res) => {
  try {
    const p_id = Number(req.params.p_id);
    const updates = {};
    const allowed = ["name", "description", "brand", "colour", "price", "category", "stock", "lowStockThreshold"];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = key === "price" ? parseFloat(req.body[key]) :
                       ["stock", "lowStockThreshold"].includes(key) ? parseInt(req.body[key]) :
                       req.body[key];
      }
    }

    if (updates.price !== undefined && updates.price < 0) {
      return res.status(400).json({ error: "Price cannot be negative" });
    }
    if (updates.stock !== undefined && updates.stock < 0) {
      return res.status(400).json({ error: "Stock cannot be negative" });
    }

    const product = await Product.findOneAndUpdate({ p_id }, updates, { new: true });
    if (!product) return res.status(404).json({ error: "Product not found" });

    res.json(product);
  } catch (err) {
    res.status(500).json({ error: "Failed to update product" });
  }
};

// GET /api/admin/products/low-stock
exports.getLowStockProducts = async (req, res) => {
  try {
    const products = await Product.find({
      ...PRODUCT_HAS_IMAGE_FILTER,
      $expr: { $lte: ["$stock", "$lowStockThreshold"] },
    }).sort({ stock: 1 });

    res.json(products);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch low stock products" });
  }
};

// GET /api/admin/orders
exports.getOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;

    const filter = {};
    if (status) filter.status = status;

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Order.countDocuments(filter),
    ]);

    res.json({ orders, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};

// PUT /api/admin/orders/:orderId/status
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["pending", "paid", "expired", "cancelled"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const order = await Order.findOne({ orderId: req.params.orderId });
    if (!order) return res.status(404).json({ error: "Order not found" });
    const previousStatus = order.status;

    if (status === previousStatus) {
      return res.json(order);
    }

    if (previousStatus === "paid" && status === "pending") {
      return res.status(400).json({ error: "Cannot move a paid order back to pending" });
    }

    if (status === "paid") {
      const { order: paidOrder } = await finalizeOrderAsPaid(order, {
        paymentMethod: order.paymentMethod || "admin-manual",
        paidAt: new Date(),
      });
      return res.json(paidOrder);
    }

    // If cancelling or expiring, restore stock
    if ((status === "cancelled" || status === "expired") && previousStatus === "pending") {
      for (const item of order.items) {
        await Product.updateOne(
          { p_id: item.productId },
          { $inc: { stock: item.quantity } }
        );
      }
    }

    order.status = status;

    if ((status === "cancelled" || status === "expired") && previousStatus === "paid") {
      await refundRedeemedPointsForOrder(order);
      await refundCouponForOrder(order);
    }

    await order.save();

    res.json(order);
  } catch (err) {
    const message = String(err?.message || "").toLowerCase();
    if (message.includes("insufficient loyalty points") || message.includes("coupon can no longer be applied")) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: "Failed to update order status" });
  }
};

// POST /api/admin/coupons
exports.createCoupon = async (req, res) => {
  try {
    const code = String(req.body?.code || "").trim().toUpperCase();
    const discountType = String(req.body?.discountType || "").trim();
    const discountValue = Number(req.body?.discountValue);
    const minOrderValue = Number(req.body?.minOrderValue || 0);
    const maxUsesRaw = req.body?.maxUses;
    const maxUses = maxUsesRaw === "" || maxUsesRaw === null || maxUsesRaw === undefined
      ? null
      : Number(maxUsesRaw);
    const expiresAt = req.body?.expiresAt ? new Date(req.body.expiresAt) : null;
    const isActive = req.body?.isActive === undefined ? true : !!req.body.isActive;

    if (!code) return res.status(400).json({ error: "code is required" });
    if (!["percentage", "fixed"].includes(discountType)) {
      return res.status(400).json({ error: "discountType must be percentage or fixed" });
    }
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      return res.status(400).json({ error: "discountValue must be greater than 0" });
    }
    if (!Number.isFinite(minOrderValue) || minOrderValue < 0) {
      return res.status(400).json({ error: "minOrderValue must be 0 or greater" });
    }
    if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses <= 0)) {
      return res.status(400).json({ error: "maxUses must be a positive integer or null" });
    }
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      return res.status(400).json({ error: "expiresAt must be a valid date" });
    }

    const coupon = await Coupon.create({
      code,
      discountType,
      discountValue,
      minOrderValue,
      maxUses,
      expiresAt,
      isActive,
    });

    return res.status(201).json(coupon);
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(400).json({ error: "Coupon code already exists" });
    }
    return res.status(500).json({ error: "Failed to create coupon" });
  }
};

// GET /api/admin/coupons
exports.getCoupons = async (_req, res) => {
  try {
    const coupons = await Coupon.find({}).sort({ createdAt: -1 });
    return res.json(coupons);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch coupons" });
  }
};

// PUT /api/admin/coupons/:id
exports.updateCoupon = async (req, res) => {
  try {
    const updates = {};
    const allowed = ["discountType", "discountValue", "minOrderValue", "maxUses", "expiresAt", "isActive"];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates[key] = req.body[key];
      }
    }
    if (updates.discountType !== undefined && !["percentage", "fixed"].includes(String(updates.discountType))) {
      return res.status(400).json({ error: "discountType must be percentage or fixed" });
    }
    if (updates.discountValue !== undefined) {
      const value = Number(updates.discountValue);
      if (!Number.isFinite(value) || value <= 0) {
        return res.status(400).json({ error: "discountValue must be greater than 0" });
      }
      updates.discountValue = value;
    }
    if (updates.minOrderValue !== undefined) {
      const value = Number(updates.minOrderValue);
      if (!Number.isFinite(value) || value < 0) {
        return res.status(400).json({ error: "minOrderValue must be 0 or greater" });
      }
      updates.minOrderValue = value;
    }
    if (updates.maxUses !== undefined) {
      if (updates.maxUses === "" || updates.maxUses === null) {
        updates.maxUses = null;
      } else {
        const value = Number(updates.maxUses);
        if (!Number.isInteger(value) || value <= 0) {
          return res.status(400).json({ error: "maxUses must be a positive integer or null" });
        }
        updates.maxUses = value;
      }
    }
    if (updates.expiresAt !== undefined) {
      updates.expiresAt = updates.expiresAt ? new Date(updates.expiresAt) : null;
      if (updates.expiresAt && Number.isNaN(updates.expiresAt.getTime())) {
        return res.status(400).json({ error: "expiresAt must be a valid date" });
      }
    }

    const coupon = await Coupon.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!coupon) return res.status(404).json({ error: "Coupon not found" });
    return res.json(coupon);
  } catch (err) {
    return res.status(500).json({ error: "Failed to update coupon" });
  }
};

// DELETE /api/admin/coupons/:id
exports.deleteCoupon = async (req, res) => {
  try {
    const deleted = await Coupon.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Coupon not found" });
    return res.json({ message: "Coupon deleted" });
  } catch (err) {
    return res.status(500).json({ error: "Failed to delete coupon" });
  }
};

// PUT /api/admin/settings/double-points
exports.updateDoublePointsSetting = async (req, res) => {
  try {
    const enabled = !!req.body?.enabled;
    const endsAt = req.body?.endsAt || null;

    const status = await upsertDoublePointsSetting({ enabled, endsAt });
    return res.json(status.active ? { active: true, endsAt: status.endsAt } : { active: false });
  } catch (err) {
    return res.status(400).json({ error: err.message || "Failed to update double points setting" });
  }
};

// GET /api/admin/settings/double-points
exports.getDoublePointsSetting = async (_req, res) => {
  try {
    const status = await getDoublePointsStatus();
    return res.json(status.active ? { active: true, endsAt: status.endsAt } : { active: false });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch double points setting" });
  }
};

// GET /api/admin/stripe/overview
exports.getStripeOverview = async (_req, res) => {
  try {
    const stripe = getStripeClient();
    const [balance, paymentIntents] = await Promise.all([
      stripe.balance.retrieve(),
      stripe.paymentIntents.list({ limit: 10 }),
    ]);

    const usdToLkrRate = Number(process.env.STRIPE_USD_TO_LKR_RATE || 300);
    const toMajor = (amount) => (Number.isFinite(amount) ? amount / 100 : 0);
    const toLkr = (amount, currency) => {
      const normalized = String(currency || "").toLowerCase();
      const major = toMajor(amount);
      if (normalized === "lkr") return Math.round(major);
      if (normalized === "usd") return Math.round(major * usdToLkrRate);
      return 0;
    };

    const summarize = (entries) =>
      (entries || []).map((entry) => ({
        currency: String(entry.currency || "").toUpperCase(),
        amountMajor: toMajor(entry.amount),
        lkrEquivalent: toLkr(entry.amount, entry.currency),
      }));

    const availableBreakdown = summarize(balance.available);
    const pendingBreakdown = summarize(balance.pending);

    const lkrAvailable = availableBreakdown.reduce((sum, entry) => sum + entry.lkrEquivalent, 0);
    const lkrPending = pendingBreakdown.reduce((sum, entry) => sum + entry.lkrEquivalent, 0);

    const recentPayments = (paymentIntents.data || []).map((pi) => ({
      id: pi.id,
      amountMajor: toMajor(pi.amount_received || pi.amount || 0),
      lkrAmount: toLkr(pi.amount_received || pi.amount || 0, pi.currency),
      currency: String(pi.currency || "").toUpperCase(),
      status: pi.status,
      createdAt: pi.created ? new Date(pi.created * 1000) : null,
      orderId: pi.metadata?.orderId || null,
      receiptEmail: pi.receipt_email || null,
    }));

    return res.json({
      balance: {
        lkrAvailable,
        lkrPending,
        availableBreakdown,
        pendingBreakdown,
        usdToLkrRate,
      },
      recentPayments,
    });
  } catch (err) {
    const message = String(err?.message || "");
    if (message.includes("STRIPE_SECRET_KEY")) {
      return res.status(500).json({ error: "Stripe is not configured" });
    }
    return res.status(500).json({ error: "Failed to fetch Stripe overview" });
  }
};

// GET /api/admin/customers
exports.getCustomers = async (req, res) => {
  try {
    const customers = await User.find({ role: "customer" })
      .select("email role loyaltyTier loyaltyPoints totalOrders createdAt")
      .sort({ totalOrders: -1 });

    res.json(customers);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch customers" });
  }
};

// GET /api/admin/riders
exports.getAllRiders = async (req, res) => {
  try {
    const riders = await User.find({ role: "rider" })
      .select(
        "name email mobileNumber isAvailable vehicleType role riderApprovalStatus riderAppliedAt createdAt"
      )
      .sort({ createdAt: -1 })
      .lean();

    const riderIds = riders.map((r) => r._id);
    const activeDeliveries = await Delivery.find({
      riderId: { $in: riderIds },
      status: { $nin: TERMINAL_DELIVERY_STATUSES },
    })
      .sort({ createdAt: -1 })
      .lean();

    const activeByRider = new Map();
    for (const delivery of activeDeliveries) {
      const key = String(delivery.riderId);
      if (!activeByRider.has(key)) {
        activeByRider.set(key, delivery);
      }
    }

    const result = riders.map((rider) => ({
      ...rider,
      phone: rider.mobileNumber || "",
      activeDelivery: activeByRider.get(String(rider._id)) || null,
    }));

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch riders" });
  }
};

// PUT /api/admin/riders/:riderId/approval
exports.updateRiderApproval = async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ error: "status must be approved or rejected" });
    }

    const rider = await User.findOne({ _id: req.params.riderId, role: "rider" });
    if (!rider) return res.status(404).json({ error: "Rider not found" });

    rider.riderApprovalStatus = status;
    if (status !== "approved") {
      rider.isAvailable = false;
    }
    await rider.save();

    return res.json({
      rider: {
        _id: rider._id,
        name: rider.name || "",
        email: rider.email,
        mobileNumber: rider.mobileNumber || "",
        vehicleType: rider.vehicleType || "bike",
        role: rider.role,
        riderApprovalStatus: rider.riderApprovalStatus,
        isAvailable: rider.isAvailable,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to update rider approval" });
  }
};

// POST /api/admin/deliveries/:deliveryId/assign-rider
exports.assignRiderToDelivery = async (req, res) => {
  try {
    const { riderId } = req.body || {};
    if (!riderId) return res.status(400).json({ error: "riderId is required" });

    const rider = await User.findOne({
      _id: riderId,
      role: "rider",
      riderApprovalStatus: "approved",
    })
      .select("_id name email mobileNumber isAvailable vehicleType")
      .lean();
    if (!rider) return res.status(404).json({ error: "Rider not found" });

    const delivery = await Delivery.findOne({ deliveryId: req.params.deliveryId });
    if (!delivery) return res.status(404).json({ error: "Delivery not found" });
    if (TERMINAL_DELIVERY_STATUSES.includes(delivery.status)) {
      return res.status(400).json({ error: "Cannot assign rider to a completed delivery" });
    }

    const activeDelivery = await Delivery.findOne({
      riderId: rider._id,
      status: { $nin: TERMINAL_DELIVERY_STATUSES },
      _id: { $ne: delivery._id },
    })
      .select("deliveryId")
      .lean();
    if (activeDelivery) {
      return res.status(409).json({
        error: `Rider already has an active delivery (${activeDelivery.deliveryId})`,
      });
    }

    delivery.riderId = rider._id;
    delivery.assignedAt = new Date();
    delivery.vehicleType = rider.vehicleType || "bike";
    await delivery.save();

    const updated = await Delivery.findById(delivery._id)
      .populate("riderId", "name email mobileNumber isAvailable")
      .lean();

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: "Failed to assign rider" });
  }
};

// GET /api/admin/reports/sales
exports.getSalesReport = async (req, res) => {
  try {
    const startDate = req.query.start ? new Date(req.query.start) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = req.query.end ? new Date(req.query.end) : new Date();

    const [categoryBreakdown, summary] = await Promise.all([
      Order.aggregate([
        { $match: { status: "paid", paidAt: { $gte: startDate, $lte: endDate } } },
        { $unwind: "$items" },
        {
          $lookup: {
            from: "products",
            localField: "items.productId",
            foreignField: "p_id",
            as: "product",
          },
        },
        { $unwind: { path: "$product", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: "$product.category",
            revenue: { $sum: { $multiply: ["$items.unitPrice", "$items.quantity"] } },
            itemsSold: { $sum: "$items.quantity" },
          },
        },
        { $project: { category: { $ifNull: ["$_id", "Unknown"] }, revenue: 1, itemsSold: 1, _id: 0 } },
      ]),
      Order.aggregate([
        { $match: { status: "paid", paidAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: "$total" },
            totalOrders: { $sum: 1 },
            avgOrderValue: { $avg: "$total" },
          },
        },
      ]),
    ]);

    res.json({
      categoryBreakdown,
      summary: summary[0] || { totalRevenue: 0, totalOrders: 0, avgOrderValue: 0 },
      period: { start: startDate, end: endDate },
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate sales report" });
  }
};

// DELETE /api/admin/products/:p_id - Remove a product
exports.deleteProduct = async (req, res) => {
  try {
    const p_id = Number(req.params.p_id);
    const product = await Product.findOne({ p_id });
    if (!product) return res.status(404).json({ error: "Product not found" });

    // Delete the image from GridFS if it exists
    if (product.image_id) {
      try {
        const db = mongoose.connection.db;
        const bucket = new mongoose.mongo.GridFSBucket(db);
        await bucket.delete(product.image_id);
      } catch (imgErr) {
        console.error("Failed to delete image from GridFS:", imgErr.message);
      }
    }

    await Product.deleteOne({ p_id });
    res.json({ message: `Product "${product.name}" (p_id: ${p_id}) deleted successfully` });
  } catch (err) {
    console.error("Delete product error:", err);
    res.status(500).json({ error: "Failed to delete product" });
  }
};

// POST /api/admin/products/restock - Restock all out-of-stock products
exports.restockProducts = async (req, res) => {
  try {
    const stockAmount = parseInt(req.body.stock) || 50;
    const result = await Product.updateMany(
      { ...PRODUCT_HAS_IMAGE_FILTER, stock: { $lte: 0 } },
      { $set: { stock: stockAmount } }
    );
    res.json({ message: `Restocked ${result.modifiedCount} products to ${stockAmount} units` });
  } catch (err) {
    res.status(500).json({ error: "Failed to restock products" });
  }
};

// PUT /api/admin/products/:p_id/restock - Restock a single product
exports.restockSingleProduct = async (req, res) => {
  try {
    const p_id = Number(req.params.p_id);
    const stockAmount = parseInt(req.body.stock) || 50;
    const product = await Product.findOneAndUpdate(
      { p_id },
      { $set: { stock: stockAmount } },
      { new: true }
    );
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json(product);
  } catch (err) {
    res.status(500).json({ error: "Failed to restock product" });
  }
};

// GET /api/admin/deliveries - Get all deliveries
exports.getDeliveries = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const status = req.query.status;
    const method = req.query.method;

    const filter = {};
    if (status) filter.status = status;
    if (method) filter.deliveryMethod = method;

    const [deliveries, total] = await Promise.all([
      Delivery.find(filter)
        .populate("riderId", "name email mobileNumber isAvailable")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Delivery.countDocuments(filter),
    ]);

    res.json({ deliveries, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch deliveries" });
  }
};

// GET /api/admin/deliveries/stats - Delivery dashboard stats
exports.getDeliveryStats = async (req, res) => {
  try {
    const [statusCounts, methodCounts, totalFees] = await Promise.all([
      Delivery.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Delivery.aggregate([
        { $group: { _id: "$deliveryMethod", count: { $sum: 1 } } },
      ]),
      Delivery.aggregate([
        { $group: { _id: null, totalFees: { $sum: "$deliveryFee" }, total: { $sum: 1 } } },
      ]),
    ]);

    res.json({
      byStatus: statusCounts.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
      byMethod: methodCounts.reduce((acc, m) => ({ ...acc, [m._id]: m.count }), {}),
      totalDeliveries: totalFees[0]?.total || 0,
      totalFees: totalFees[0]?.totalFees || 0,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch delivery stats" });
  }
};

// PUT /api/admin/deliveries/:deliveryId/status - Update delivery status
exports.updateDeliveryStatus = async (req, res) => {
  try {
    const { status, note, proofOfDelivery } = req.body;
    const validStatuses = ["pending_pickup", "in_transit", "delivered", "failed", "returned"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid delivery status" });
    }

    const delivery = await Delivery.findOne({ deliveryId: req.params.deliveryId });
    if (!delivery) return res.status(404).json({ error: "Delivery not found" });

    delivery.status = status;
    delivery.statusHistory.push({
      status,
      timestamp: new Date(),
      note: note || "",
    });

    if (status === "delivered") {
      delivery.deliveredAt = new Date();
      if (proofOfDelivery) delivery.proofOfDelivery = proofOfDelivery;
    }

    await delivery.save();
    broadcastDeliveryUpdate(delivery.toObject());
    sendDeliveryStatusPush(delivery.toObject()).catch((err) => {
      console.error("Push notification error:", err.message);
    });
    res.json(delivery);
  } catch (err) {
    res.status(500).json({ error: "Failed to update delivery status" });
  }
};

// PUT /api/admin/deliveries/:deliveryId/live - Update live location/ETA
exports.updateDeliveryLive = async (req, res) => {
  try {
    const rawLocation = typeof req.body.currentLocation === "string" ? req.body.currentLocation.trim() : "";
    const rawEta = req.body.etaMinutes;
    const rawLat = req.body.currentLat;
    const rawLng = req.body.currentLng;
    const note = typeof req.body.note === "string" ? req.body.note.trim() : "";

    const hasEta = !(rawEta === undefined || rawEta === null || rawEta === "");
    const hasLat = !(rawLat === undefined || rawLat === null || rawLat === "");
    const hasLng = !(rawLng === undefined || rawLng === null || rawLng === "");
    const wantsLiveUpdate = !!rawLocation || hasEta || hasLat || hasLng;

    if (!wantsLiveUpdate && !note) {
      return res.status(400).json({ error: "Provide currentLocation, etaMinutes, coordinates, or note" });
    }

    let etaMinutes = null;
    let currentLat = null;
    let currentLng = null;

    const delivery = await Delivery.findOne({ deliveryId: req.params.deliveryId });
    if (!delivery) return res.status(404).json({ error: "Delivery not found" });

    if (delivery.riderId && wantsLiveUpdate) {
      return res.status(400).json({
        error: "Live location and ETA are managed by the assigned rider for this delivery",
      });
    }

    if (wantsLiveUpdate && rawLocation.length > 120) {
      return res.status(400).json({ error: "Location is too long (max 120 characters)" });
    }

    if (wantsLiveUpdate && hasEta) {
      etaMinutes = Number(rawEta);
      if (!Number.isInteger(etaMinutes) || etaMinutes < 0 || etaMinutes > 7 * 24 * 60) {
        return res.status(400).json({ error: "etaMinutes must be an integer between 0 and 10080" });
      }
    }

    if (wantsLiveUpdate && hasLat !== hasLng) {
      return res.status(400).json({ error: "Provide both currentLat and currentLng together" });
    }

    if (wantsLiveUpdate && hasLat && hasLng) {
      currentLat = Number(rawLat);
      currentLng = Number(rawLng);
      if (!Number.isFinite(currentLat) || currentLat < -90 || currentLat > 90) {
        return res.status(400).json({ error: "currentLat must be between -90 and 90" });
      }
      if (!Number.isFinite(currentLng) || currentLng < -180 || currentLng > 180) {
        return res.status(400).json({ error: "currentLng must be between -180 and 180" });
      }
    }

    const geocodeSummary = {
      currentResolved: false,
      destinationResolved: false,
      currentMessage: "",
      destinationMessage: "",
    };

    if (wantsLiveUpdate && rawLocation) {
      delivery.currentLocation = rawLocation;
    }

    if (wantsLiveUpdate && etaMinutes !== null) {
      delivery.etaMinutes = etaMinutes;
    }
    if (wantsLiveUpdate && currentLat !== null && currentLng !== null) {
      delivery.currentLat = currentLat;
      delivery.currentLng = currentLng;
      geocodeSummary.currentResolved = true;
      geocodeSummary.currentMessage = "Current coordinates provided manually.";
    } else if (wantsLiveUpdate && rawLocation) {
      const currentCoords = await geocodeAddress(rawLocation);
      if (currentCoords) {
        delivery.currentLat = currentCoords.lat;
        delivery.currentLng = currentCoords.lng;
        geocodeSummary.currentResolved = true;
        geocodeSummary.currentMessage = "Current location resolved successfully.";
      } else {
        geocodeSummary.currentMessage =
          "Could not resolve current location to coordinates. Try a more specific place name.";
      }
    }

    if (wantsLiveUpdate && (delivery.destinationLat === null || delivery.destinationLng === null)) {
      const destinationText = [
        delivery.deliveryAddress?.street,
        delivery.deliveryAddress?.city,
        delivery.deliveryAddress?.state,
        delivery.deliveryAddress?.zip,
        delivery.deliveryAddress?.country,
      ]
        .filter(Boolean)
        .join(", ");

      const destinationCoords = await geocodeAddress(destinationText);
      if (destinationCoords) {
        delivery.destinationLat = destinationCoords.lat;
        delivery.destinationLng = destinationCoords.lng;
        geocodeSummary.destinationResolved = true;
        geocodeSummary.destinationMessage = "Destination resolved successfully.";
      } else {
        geocodeSummary.destinationMessage =
          "Could not resolve destination address for map routing. Please verify address details.";
      }
    } else if (wantsLiveUpdate) {
      geocodeSummary.destinationResolved = true;
      geocodeSummary.destinationMessage = "Destination coordinates already available.";
    }

    if (wantsLiveUpdate) {
      delivery.liveUpdatedAt = new Date();
    }

    if (note) {
      delivery.statusHistory.push({
        status: delivery.status,
        timestamp: new Date(),
        note,
      });
    }

    await delivery.save();
    broadcastDeliveryUpdate(delivery.toObject());
    res.json({ ...delivery.toObject(), geocodeSummary });
  } catch (err) {
    res.status(500).json({ error: "Failed to update live delivery info" });
  }
};

// GET /api/admin/reports/stock
exports.getStockReport = async (req, res) => {
  try {
    const [distribution, products] = await Promise.all([
      Product.aggregate([
        { $match: PRODUCT_HAS_IMAGE_FILTER },
        {
          $project: {
            status: {
              $cond: [
                { $eq: ["$stock", 0] }, "Out of Stock",
                { $cond: [{ $lte: ["$stock", "$lowStockThreshold"] }, "Low Stock", "In Stock"] },
              ],
            },
          },
        },
        { $group: { _id: "$status", count: { $sum: 1 } } },
        { $project: { status: "$_id", count: 1, _id: 0 } },
      ]),
      Product.find(PRODUCT_HAS_IMAGE_FILTER)
        .select("p_id name brand category stock lowStockThreshold")
        .sort({ stock: 1 })
        .limit(100),
    ]);

    res.json({ distribution, products });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate stock report" });
  }
};
