const Order = require("../models/Order");
const Product = require("../models/Product");

async function expirePendingOrders() {
  try {
    const expiredOrders = await Order.find({
      status: "pending",
      expiresAt: { $lt: new Date() },
    });

    for (const order of expiredOrders) {
      // Restore stock for each item
      for (const item of order.items) {
        await Product.updateOne(
          { p_id: item.productId },
          { $inc: { stock: item.quantity } }
        );
      }

      order.status = "expired";
      await order.save();
      console.log(`Order ${order.orderId} expired - stock restored`);
    }
  } catch (err) {
    console.error("Order expiry check error:", err);
  }
}

function startExpiryService() {
  // Check every 60 seconds for expired orders
  const interval = setInterval(expirePendingOrders, 60 * 1000);
  console.log("Order expiry service started (checking every 60s)");
  return interval;
}

module.exports = { startExpiryService, expirePendingOrders };
