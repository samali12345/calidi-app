const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const Stripe = require("stripe");
const Order = require("../models/Order");
const { finalizeOrderAsPaid } = require("../services/orderPaymentService");

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

async function stripeWebhookHandler(req, res) {
  try {
    if (!process.env.STRIPE_SECRET_KEY || !process.env.STRIPE_WEBHOOK_SECRET) {
      return res.status(500).send("Stripe webhook env vars not configured");
    }

    const stripe = getStripe();
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      return res.status(400).send("Missing stripe-signature header");
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      return res.status(400).send(`Webhook signature verification failed: ${err.message}`);
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const orderId = session?.metadata?.orderId;
      if (orderId) {
        const order = await Order.findOne({ orderId });
        if (order) {
          await finalizeOrderAsPaid(order, {
            paymentMethod: "stripe",
            stripeSessionId: session.id || null,
            stripePaymentIntentId: session.payment_intent || null,
            paidAt: new Date(),
          });
        }
      }
    }

    return res.json({ received: true });
  } catch (err) {
    console.error("Stripe webhook error:", err.message);
    return res.status(500).send("Webhook handler failed");
  }
}

// POST /api/checkout/create-session
// Supports:
// - orderId flow (recommended): creates Stripe checkout for an existing pending order.
// - legacy lineItems flow: keeps backward compatibility.
router.post("/create-session", protect, async (req, res) => {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: "STRIPE_SECRET_KEY is not configured" });
    }

    const stripe = getStripe();
    const { lineItems, shippingAddress, orderId } = req.body;
    let checkoutOrder = null;
    let stripeLineItems = [];
    let metadata = {};

    if (orderId) {
      checkoutOrder = await Order.findOne({ orderId });
      if (!checkoutOrder) return res.status(404).json({ error: "Order not found" });
      if (checkoutOrder.userId !== req.user.uid) {
        return res.status(403).json({ error: "Not authorized" });
      }
      if (checkoutOrder.status !== "pending") {
        return res.status(400).json({ error: `Cannot pay for ${checkoutOrder.status} order` });
      }

      stripeLineItems = checkoutOrder.items.map((item) => ({
        price_data: {
          currency: "lkr",
          product_data: { name: item.name },
          unit_amount: Math.round(item.unitPrice * 100),
        },
        quantity: item.quantity,
      }));

      metadata = {
        orderId: checkoutOrder.orderId,
        userId: checkoutOrder.userId,
      };
    } else {
      if (!lineItems?.length) {
        return res.status(400).json({ error: "Cart is empty" });
      }

      stripeLineItems = lineItems.map((item) => ({
        price_data: {
          currency: "lkr",
          product_data: { name: item.name },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      }));

      metadata = {
        shipping_name: shippingAddress?.fullName || "",
        shipping_street: shippingAddress?.street || "",
        shipping_city: shippingAddress?.city || "",
        shipping_state: shippingAddress?.state || "",
        shipping_zip: shippingAddress?.zip || "",
        shipping_country: shippingAddress?.country || "",
      };
    }

    const customers = await stripe.customers.list({ email: req.user.email, limit: 1 });
    const customerId = customers.data[0]?.id;

    const successUrl = checkoutOrder
      ? `${process.env.CLIENT_URL}/payment-success/${checkoutOrder.orderId}?session_id={CHECKOUT_SESSION_ID}`
      : `${process.env.CLIENT_URL}/payment-success`;

    const cancelUrl = checkoutOrder
      ? `${process.env.CLIENT_URL}/payment/${checkoutOrder.orderId}`
      : `${process.env.CLIENT_URL}/payment-canceled`;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : req.user.email,
      line_items: stripeLineItems,
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
    });

    if (checkoutOrder) {
      checkoutOrder.stripeSessionId = session.id;
      checkoutOrder.paymentMethod = "stripe";
      await checkoutOrder.save();
    }

    res.json({ url: session.url, sessionId: session.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = {
  router,
  stripeWebhookHandler,
};

