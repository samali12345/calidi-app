const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const Delivery = require("../models/Delivery");
const Order = require("../models/Order");
const User = require("../models/User");
const admin = require("../config/firebase");
const { addClient, removeClient, writeEvent } = require("../services/deliveryRealtime");
const { geocodeAddressGoogle } = require("../services/googleMaps");

const buildDestinationQueries = (delivery) => {
  const street = delivery?.deliveryAddress?.street || "";
  const city = delivery?.deliveryAddress?.city || "";
  const state = delivery?.deliveryAddress?.state || "";
  const zip = delivery?.deliveryAddress?.zip || "";
  const country = delivery?.deliveryAddress?.country || "";

  return [
    [street, city, state, zip, country].filter(Boolean).join(", "),
    [street, city, state, country].filter(Boolean).join(", "),
    [city, state, country].filter(Boolean).join(", "),
    [city, country].filter(Boolean).join(", "),
    country ? `Sri Lanka` : "",
  ].filter(Boolean);
};

const ensureDestinationCoordinates = async (deliveryDoc) => {
  if (!deliveryDoc) return deliveryDoc;
  if (deliveryDoc.destinationLat !== null && deliveryDoc.destinationLng !== null) {
    return deliveryDoc;
  }

  const queries = buildDestinationQueries(deliveryDoc);
  for (const query of queries) {
    const coords = await geocodeAddressGoogle(query);
    if (!coords) continue;
    deliveryDoc.destinationLat = coords.lat;
    deliveryDoc.destinationLng = coords.lng;
    await deliveryDoc.save();
    return deliveryDoc;
  }

  return deliveryDoc;
};

// GET /api/deliveries - Get user's deliveries
router.get("/", protect, async (req, res) => {
  try {
    const deliveries = await Delivery.find({ userId: req.user.uid }).sort({
      createdAt: -1,
    });
    res.json(deliveries);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch deliveries" });
  }
});

// GET /api/deliveries/:deliveryId - Get single delivery
router.get("/:deliveryId", protect, async (req, res) => {
  try {
    let delivery = await Delivery.findOne({
      deliveryId: req.params.deliveryId,
    });
    if (!delivery) return res.status(404).json({ error: "Delivery not found" });
    if (delivery.userId !== req.user.uid && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }
    delivery = await ensureDestinationCoordinates(delivery);
    res.json(delivery);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch delivery" });
  }
});

// GET /api/deliveries/order/:orderId - Get delivery by order ID
router.get("/order/:orderId", protect, async (req, res) => {
  try {
    const delivery = await Delivery.findOne({ orderId: req.params.orderId });
    if (!delivery) return res.status(404).json({ error: "Delivery not found" });
    if (delivery.userId !== req.user.uid && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }
    res.json(delivery);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch delivery" });
  }
});

// GET /api/deliveries/:deliveryId/stream?token=<firebase-id-token>
// SSE endpoint for live delivery updates
router.get("/:deliveryId/stream", async (req, res) => {
  const { deliveryId } = req.params;
  const authHeader = req.headers.authorization || "";
  const tokenFromHeader = authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : "";
  const idToken = req.query.token || tokenFromHeader;

  if (!idToken) {
    return res.status(401).json({ error: "Missing auth token" });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const dbUser = await User.findOne({ email: decodedToken.email });
    const role = dbUser?.role || "customer";

    let delivery = await Delivery.findOne({ deliveryId });
    if (!delivery) {
      return res.status(404).json({ error: "Delivery not found" });
    }

    if (delivery.userId !== decodedToken.uid && role !== "admin") {
      return res.status(403).json({ error: "Not authorized" });
    }

    delivery = await ensureDestinationCoordinates(delivery);

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    // Suggest auto-reconnect delay to EventSource clients
    res.write("retry: 5000\n\n");

    addClient(deliveryId, res);
    writeEvent(res, "delivery_snapshot", {
      type: "delivery_snapshot",
      delivery,
      at: new Date().toISOString(),
    });

    const keepAlive = setInterval(() => {
      res.write(`: keepalive ${Date.now()}\n\n`);
    }, 25000);

    req.on("close", () => {
      clearInterval(keepAlive);
      removeClient(deliveryId, res);
    });
  } catch (err) {
    console.error("Delivery stream auth error:", err.message);
    return res.status(401).json({ error: "Not authorized - invalid token" });
  }
});

// GET /api/deliveries/methods/available - Get delivery methods with fees
router.get("/methods/available", async (req, res) => {
  const city = (req.query.city || "").toLowerCase();

  // Cities with same-day delivery available
  const sameDayCities = ["colombo", "dehiwala", "moratuwa", "negombo", "kandy"];
  // Cities with express delivery
  const expressCities = [
    ...sameDayCities,
    "galle", "matara", "jaffna", "batticaloa", "trincomalee",
    "anuradhapura", "kurunegala", "ratnapura", "badulla", "nuwara eliya",
  ];

  const methods = [
    {
      id: "standard",
      name: "Standard Delivery",
      description: "5-7 business days",
      fee: 350,
      available: true,
    },
    {
      id: "express",
      name: "Express Delivery",
      description: "2-3 business days",
      fee: 750,
      available: expressCities.includes(city) || !city,
    },
    {
      id: "same-day",
      name: "Same-Day Delivery",
      description: "Delivered today (order before 2 PM)",
      fee: 1500,
      available: sameDayCities.includes(city),
    },
  ];

  res.json(methods);
});

module.exports = router;
