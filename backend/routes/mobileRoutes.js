const express = require('express');
const router = express.Router();
const { protectJWT } = require('../middleware/authJWT');
const User = require('../models/User');
const Order = require('../models/Order');
const mongoose = require('mongoose');
const { generateInvoiceHTML } = require('../services/invoiceService');

// ─── GET /api/mobile/me ────────────────────────────────────────────────────
router.get('/me', protectJWT, (req, res) => {
  res.json({ user: req.user });
});

// ─── PUT /api/mobile/me ─── update profile ─────────────────────────────────
router.put('/me', protectJWT, async (req, res) => {
  try {
    const { name, mobileNumber } = req.body;
    const updates = {};
    if (name) updates.name = name.trim();
    if (mobileNumber) updates.mobileNumber = mobileNumber.trim();

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
    res.json({ success: true, user: { id: user._id, email: user.email, name: user.name, mobileNumber: user.mobileNumber, role: user.role } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/mobile/orders ────────────────────────────────────────────────
router.get('/orders', protectJWT, async (req, res) => {
  try {
    const orders = await Order.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(50).lean();
    
    // Fetch refunds for these orders
    const orderIds = orders.map(o => o.orderId);
    const refunds = await mongoose.model('Refund').find({ orderId: { $in: orderIds } }).lean();
    
    // Attach refund status to each order
    const ordersWithRefunds = orders.map(order => {
      const refund = refunds.find(r => r.orderId === order.orderId);
      return {
        ...order,
        refundStatus: refund ? refund.status : null,
        refundReason: refund ? refund.reason : null,
        adminComment: refund ? refund.adminComment : null
      };
    });

    res.json(ordersWithRefunds);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/mobile/orders/:id/invoice ──────────────────────────────────────
router.get('/orders/:id/invoice', protectJWT, async (req, res) => {
  try {
    const order = await Order.findOne({ _id: req.params.id, userId: req.user._id });
    if (!order) return res.status(404).send('<h1>Order not found</h1>');

    const html = generateInvoiceHTML(order);
    res.send(html);
  } catch (e) {
    res.status(500).send('<h1>Error generating invoice</h1>');
  }
});

// ─── POST /api/mobile/orders ── place order ────────────────────────────────
router.post('/orders', protectJWT, async (req, res) => {
  try {
    const { items, shippingAddress, deliveryMethod = 'standard', paymentMethod } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ error: 'No items provided' });
    }
    if (!shippingAddress || !shippingAddress.fullName || !shippingAddress.street) {
      return res.status(400).json({ error: 'Full name and street address are required' });
    }

    // Build order items from DB prices (never trust client price)
    const orderItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = await mongoose.connection.db.collection('products').findOne({ p_id: Number(item.productId) });
      if (!product) {
        return res.status(400).json({ error: `Product ${item.productId} not found` });
      }
      const unitPrice = product.price || item.price;
      orderItems.push({
        productId: product.p_id,
        name: product.name,
        size: item.size,
        quantity: item.quantity,
        unitPrice,
        image: product.img || '',
      });
      subtotal += unitPrice * item.quantity;
    }

    const deliveryFee = deliveryMethod === 'express' ? 750 : deliveryMethod === 'same-day' ? 1500 : 350;
    const totalAmount = subtotal + deliveryFee;

    const orderId = `ORD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const order = await Order.create({
      orderId,
      userId: req.user._id,
      userEmail: req.user.email,
      items: orderItems,
      shippingAddress,
      deliveryMethod,
      deliveryFee,
      subtotal,
      total: totalAmount,
      status: 'pending',
      paymentStatus: 'pending',
      paymentMethod: 'cash_on_delivery',
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    res.status(201).json({
      success: true,
      order: {
        _id: order._id,
        orderId: order.orderId,
        total: order.total,
        status: order.status,
      },
    });
  } catch (e) {
    console.error('[Mobile Orders] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/mobile/admin/stats ────────────────────────────────────────────
router.get('/admin/stats', protectJWT, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const db = mongoose.connection.db;
    const [totalOrders, totalProducts, totalUsers, revenueAgg, pendingOrders] = await Promise.all([
      Order.countDocuments(),
      db.collection('products').countDocuments(),
      User.countDocuments(),
      Order.aggregate([{ $match: { status: { $ne: 'cancelled' } } }, { $group: { _id: null, total: { $sum: '$total' } } }]),
      Order.countDocuments({ status: 'pending' }),
    ]);

    res.json({
      totalOrders,
      totalProducts,
      totalUsers,
      totalRevenue: revenueAgg[0]?.total || 0,
      pendingOrders,
    });
  } catch (e) {
    console.error('[Mobile Admin Stats] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/mobile/admin/users ──────────────────────────────────────────────
router.get('/admin/users', protectJWT, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/mobile/admin/orders ────────────────────────────────────────────
router.get('/admin/orders', protectJWT, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const orders = await Order.find().sort({ createdAt: -1 }).limit(50).populate('userId', 'name email');
    res.json(orders);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PUT /api/mobile/admin/orders/:id ─── update order status ───────────────
router.put('/admin/orders/:id', protectJWT, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(req.params.id, { status }, { new: true });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json({ success: true, order });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── GET /api/mobile/admin/products ──────────────────────────────────────────
router.get('/admin/products', protectJWT, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const products = await mongoose.connection.db.collection('products').find().sort({ p_id: -1 }).toArray();
    res.json(products);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── PUT /api/mobile/admin/products/:pid ──────────────────────────────────────
router.put('/admin/products/:pid', protectJWT, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const { name, price, stock } = req.body;
    const result = await mongoose.connection.db.collection('products').updateOne(
      { p_id: Number(req.params.pid) },
      { $set: { name, price: Number(price), stock: Number(stock) } }
    );
    if (result.matchedCount === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── DELETE /api/mobile/admin/products/:pid ───────────────────────────────────
router.delete('/admin/products/:pid', protectJWT, async (req, res) => {
  try {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const result = await mongoose.connection.db.collection('products').deleteOne({ p_id: Number(req.params.pid) });
    if (result.deletedCount === 0) return res.status(404).json({ error: 'Product not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
