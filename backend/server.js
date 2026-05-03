require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const productRoutes = require('./routes/productRoutes');
const authRoutes = require('./routes/authRoutes');
const { router: checkoutRoutes, stripeWebhookHandler } = require('./routes/checkoutRoutes');
const orderRoutes = require('./routes/orderRoutes');
const cartRoutes = require('./routes/cartRoutes');
const couponRoutes = require('./routes/couponRoutes');
const adminRoutes = require('./routes/adminRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const userRoutes = require('./routes/userRoutes');
const deliveryRoutes = require('./routes/deliveryRoutes');
const riderRoutes = require('./routes/riderRoutes');
const refundRoutes = require('./routes/refundRoutes');
const { startExpiryService } = require('./services/orderExpiry');
const { startRecommendationIndexer } = require('./services/recommendationIndexer');
const { startPointsExpiryService } = require('./services/pointsExpiryService');
const { startCartRecoveryService } = require('./services/cartRecoveryService');

const app = express();

// 1. CORS: accept requests from the Vite dev server on any loopback address
app.use(cors({
  origin: '*',
  credentials: true
}));

// Stripe webhook requires raw body for signature verification.
app.post('/api/checkout/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);

app.use(express.json());

// 2. Health Check Route: Visit http://127.0.0.1:5000/ to see if the server is alive
app.get('/', (req, res) => res.send("Backend Server is Running! ✅"));

// 3. Routing
app.use('/api/products', productRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/checkout', checkoutRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/deliveries', deliveryRoutes);
app.use('/api/rider', riderRoutes);
app.use('/api/mobile', require('./routes/mobileRoutes')); // Mount mobile routes
app.use('/api', refundRoutes);
app.use('/api/upload', require('./routes/uploadRoutes'));

const PORT = process.env.PORT || 5000;

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("📦 Connected to MongoDB Atlas");
    startExpiryService();
    startRecommendationIndexer();
    startPointsExpiryService();
    startCartRecoveryService();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Node Server running on http://0.0.0.0:${PORT}`);
    });
  })
  .catch(err => console.log("❌ MongoDB Connection Error:", err));
