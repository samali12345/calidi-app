const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const { requireRider } = require("../middleware/riderMiddleware");
const Delivery = require("../models/Delivery");
const Order = require("../models/Order");
const User = require("../models/User");
const RiderWallet = require("../models/RiderWallet");
const RiderEarning = require("../models/RiderEarning");
const { broadcastDeliveryUpdate } = require("../services/deliveryRealtime");
const {
  geocodeAddressGoogle,
  computeRouteGoogle,
} = require("../services/googleMaps");

const TERMINAL_STATUSES = ["delivered", "failed", "returned"];
const ALLOWED_VEHICLE_TYPES = ["bike", "threewheel", "van"];

function calculateRiderEarningAmount(delivery) {
  const percent = Number(process.env.RIDER_EARNING_PERCENT || 70);
  const minAmount = Number(process.env.RIDER_EARNING_MIN || 200);
  const fee = Number(delivery?.deliveryFee || 0);
  if (!Number.isFinite(fee) || fee <= 0) {
    return Math.max(0, Math.round(minAmount));
  }
  const computed = Math.round((fee * percent) / 100);
  return Math.max(Math.round(minAmount), computed);
}

async function creditRiderWalletForDelivery(delivery, riderId) {
  const amount = calculateRiderEarningAmount(delivery);
  if (amount <= 0) return;

  try {
    await RiderEarning.create({
      riderId,
      deliveryId: delivery.deliveryId,
      orderId: delivery.orderId || "",
      amount,
      status: "available",
      note: "Auto-credited after successful delivery proof submission",
      creditedAt: new Date(),
    });
  } catch (err) {
    // Duplicate key means this delivery was already credited.
    if (err && err.code === 11000) return;
    throw err;
  }

  await RiderWallet.findOneAndUpdate(
    { riderId },
    {
      $inc: {
        availableBalance: amount,
        totalEarned: amount,
      },
      $set: { lastCreditedAt: new Date() },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

async function findActiveDeliveryForRider(riderId, excludeDeliveryId = null) {
  const filter = {
    riderId,
    status: { $nin: TERMINAL_STATUSES },
  };
  if (excludeDeliveryId) {
    filter.deliveryId = { $ne: excludeDeliveryId };
  }
  return Delivery.findOne(filter).select("deliveryId status").lean();
}

function toZone(delivery) {
  const city = delivery?.deliveryAddress?.city || "";
  const state = delivery?.deliveryAddress?.state || "";
  return [city, state].filter(Boolean).join(", ");
}

async function attachOrderDetails(deliveries) {
  const orderIds = [...new Set((deliveries || []).map((d) => d.orderId).filter(Boolean))];
  if (orderIds.length === 0) return deliveries;

  const orders = await Order.find({ orderId: { $in: orderIds } })
    .select("orderId items shippingAddress createdAt")
    .lean();
  const orderMap = new Map(orders.map((o) => [o.orderId, o]));

  return deliveries.map((delivery) => {
    const order = orderMap.get(delivery.orderId);
    return {
      ...delivery,
      orderDetails: {
        itemCount:
          delivery.itemCount ||
          order?.items?.reduce((sum, item) => sum + (item.quantity || 0), 0) ||
          0,
        items: order?.items || [],
        deliveryAddress: delivery.deliveryAddress || order?.shippingAddress || null,
        zone: toZone(delivery),
      },
    };
  });
}

router.use(protect, requireRider);

// PUT /api/rider/availability
router.put("/availability", async (req, res) => {
  try {
    const isAvailable = Boolean(req.body?.isAvailable);
    const rider = await User.findByIdAndUpdate(
      req.user._id,
      { isAvailable },
      { new: true }
    ).select("name email mobileNumber role isAvailable");
    if (!rider) return res.status(404).json({ error: "Rider not found" });
    return res.json({ rider });
  } catch (err) {
    return res.status(500).json({ error: "Failed to update availability" });
  }
});

// PUT /api/rider/vehicle-type
router.put("/vehicle-type", async (req, res) => {
  try {
    const vehicleType = String(req.body?.vehicleType || "")
      .trim()
      .toLowerCase();
    if (!ALLOWED_VEHICLE_TYPES.includes(vehicleType)) {
      return res.status(400).json({ error: "vehicleType must be bike, threewheel, or van" });
    }

    const rider = await User.findByIdAndUpdate(
      req.user._id,
      { vehicleType },
      { new: true }
    ).select("name email mobileNumber role isAvailable vehicleType");
    if (!rider) return res.status(404).json({ error: "Rider not found" });

    // Keep active assigned delivery marker/icon in sync with rider profile.
    await Delivery.updateMany(
      { riderId: req.user._id, status: { $nin: TERMINAL_STATUSES } },
      { $set: { vehicleType } }
    );

    return res.json({ rider, vehicleType });
  } catch (err) {
    return res.status(500).json({ error: "Failed to update vehicle type" });
  }
});

// GET /api/rider/available-deliveries
router.get("/available-deliveries", async (req, res) => {
  try {
    const deliveries = await Delivery.find({
      status: "pending_pickup",
      $or: [{ riderId: null }, { riderId: { $exists: false } }],
    })
      .sort({ createdAt: 1 })
      .lean();

    const enriched = await attachOrderDetails(deliveries);
    return res.json(enriched);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch available deliveries" });
  }
});

// POST /api/rider/accept/:deliveryId
router.post("/accept/:deliveryId", async (req, res) => {
  try {
    const activeDelivery = await findActiveDeliveryForRider(req.user._id);
    if (activeDelivery) {
      return res.status(409).json({
        error: `Rider already has an active delivery (${activeDelivery.deliveryId})`,
      });
    }

    const delivery = await Delivery.findOne({ deliveryId: req.params.deliveryId });
    if (!delivery) return res.status(404).json({ error: "Delivery not found" });
    if (delivery.riderId) {
      return res.status(409).json({ error: "Delivery already assigned to a rider" });
    }

    delivery.riderId = req.user._id;
    delivery.assignedAt = new Date();
    delivery.vehicleType = req.user.vehicleType || "bike";
    delivery.status = "pending_pickup";
    delivery.statusHistory.push({
      status: "pending_pickup",
      timestamp: new Date(),
      note: `Accepted by rider ${req.user.name || req.user.email || ""}`.trim(),
    });
    await delivery.save();

    return res.json(delivery);
  } catch (err) {
    return res.status(500).json({ error: "Failed to accept delivery" });
  }
});

// PUT /api/rider/update-status/:deliveryId
router.put("/update-status/:deliveryId", async (req, res) => {
  try {
    const { status, note, proofOfDelivery } = req.body || {};
    if (!["in_transit", "delivered"].includes(status)) {
      return res
        .status(400)
        .json({ error: "Invalid status. Allowed: in_transit, delivered" });
    }

    const delivery = await Delivery.findOne({
      deliveryId: req.params.deliveryId,
      riderId: req.user._id,
    });
    if (!delivery) {
      return res.status(404).json({ error: "Delivery not found for this rider" });
    }

    delivery.status = status;
    delivery.statusHistory.push({
      status,
      timestamp: new Date(),
      note: note || "",
    });

    if (status === "delivered") {
      const proof = typeof proofOfDelivery === "string" ? proofOfDelivery.trim() : "";
      if (!proof) {
        return res.status(400).json({ error: "Proof of delivery is required" });
      }
      delivery.deliveredAt = new Date();
      delivery.proofOfDelivery = proof;
    }

    await delivery.save();
    if (status === "delivered") {
      await creditRiderWalletForDelivery(delivery, req.user._id);
    }
    broadcastDeliveryUpdate(delivery.toObject());
    return res.json(delivery);
  } catch (err) {
    return res.status(500).json({ error: "Failed to update delivery status" });
  }
});

// PUT /api/rider/update-location/:deliveryId
router.put("/update-location/:deliveryId", async (req, res) => {
  try {
    const { currentLat, currentLng, currentLocation, etaMinutes } = req.body || {};

    const delivery = await Delivery.findOne({
      deliveryId: req.params.deliveryId,
      riderId: req.user._id,
    });
    if (!delivery) {
      return res.status(404).json({ error: "Delivery not found for this rider" });
    }

    const hasEta = !(etaMinutes === undefined || etaMinutes === null || etaMinutes === "");
    const hasLat = !(currentLat === undefined || currentLat === null || currentLat === "");
    const hasLng = !(currentLng === undefined || currentLng === null || currentLng === "");
    const locationText = typeof currentLocation === "string" ? currentLocation.trim() : "";
    const hasLocationText = locationText.length > 0;

    if (!hasLocationText && !hasEta && !hasLat && !hasLng) {
      return res.status(400).json({ error: "Provide currentLocation, etaMinutes, or coordinates" });
    }

    if (locationText.length > 120) {
      return res.status(400).json({ error: "Location is too long (max 120 characters)" });
    }

    if (hasLat !== hasLng) {
      return res.status(400).json({ error: "Provide both currentLat and currentLng together" });
    }

    if (currentLat !== undefined && currentLat !== null && currentLat !== "") {
      const lat = Number(currentLat);
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        return res.status(400).json({ error: "currentLat must be between -90 and 90" });
      }
      delivery.currentLat = lat;
    }

    if (currentLng !== undefined && currentLng !== null && currentLng !== "") {
      const lng = Number(currentLng);
      if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
        return res
          .status(400)
          .json({ error: "currentLng must be between -180 and 180" });
      }
      delivery.currentLng = lng;
    }

    if (hasLocationText) {
      delivery.currentLocation = locationText;
    }

    if (hasEta) {
      const eta = Number(etaMinutes);
      if (!Number.isInteger(eta) || eta < 0) {
        return res.status(400).json({ error: "etaMinutes must be a positive integer" });
      }
      delivery.etaMinutes = eta;
    }

    if (hasLocationText && !(hasLat && hasLng)) {
      const currentCoords = await geocodeAddressGoogle(locationText);
      if (currentCoords) {
        delivery.currentLat = currentCoords.lat;
        delivery.currentLng = currentCoords.lng;
      }
    }

    if (delivery.destinationLat === null || delivery.destinationLng === null) {
      const destinationText = [
        delivery.deliveryAddress?.street,
        delivery.deliveryAddress?.city,
        delivery.deliveryAddress?.state,
        delivery.deliveryAddress?.zip,
        delivery.deliveryAddress?.country,
      ]
        .filter(Boolean)
        .join(", ");

      const destinationCoords = await geocodeAddressGoogle(destinationText);
      if (destinationCoords) {
        delivery.destinationLat = destinationCoords.lat;
        delivery.destinationLng = destinationCoords.lng;
      }
    }

    if (!delivery.vehicleType || delivery.vehicleType === "unknown") {
      delivery.vehicleType = req.user.vehicleType || "bike";
    }

    if (
      delivery.currentLat !== null &&
      delivery.currentLng !== null &&
      delivery.destinationLat !== null &&
      delivery.destinationLng !== null
    ) {
      const route = await computeRouteGoogle({
        originLat: delivery.currentLat,
        originLng: delivery.currentLng,
        destinationLat: delivery.destinationLat,
        destinationLng: delivery.destinationLng,
      });
      if (route) {
        if (route.etaMinutes !== null) {
          delivery.etaMinutes = route.etaMinutes;
        }
        if (route.encodedPolyline) {
          delivery.routePolyline = route.encodedPolyline;
        }
      }
    }

    delivery.liveUpdatedAt = new Date();
    await delivery.save();
    broadcastDeliveryUpdate(delivery.toObject());
    return res.json(delivery);
  } catch (err) {
    return res.status(500).json({ error: "Failed to update location" });
  }
});

// GET /api/rider/my-deliveries
router.get("/my-deliveries", async (req, res) => {
  try {
    const deliveries = await Delivery.find({ riderId: req.user._id })
      .sort({ createdAt: -1 })
      .lean();
    const enriched = await attachOrderDetails(deliveries);
    return res.json(enriched);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch rider deliveries" });
  }
});

// GET /api/rider/active-delivery
router.get("/active-delivery", async (req, res) => {
  try {
    const delivery = await Delivery.findOne({
      riderId: req.user._id,
      status: { $nin: TERMINAL_STATUSES },
    })
      .sort({ createdAt: -1 })
      .lean();

    if (!delivery) return res.json(null);
    const [enriched] = await attachOrderDetails([delivery]);
    return res.json(enriched || null);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch active delivery" });
  }
});

// GET /api/rider/wallet
router.get("/wallet", async (req, res) => {
  try {
    let wallet = await RiderWallet.findOne({ riderId: req.user._id }).lean();
    if (!wallet) {
      wallet = await RiderWallet.create({ riderId: req.user._id });
      wallet = wallet.toObject();
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(todayStart.getDate() - 7);

    const [todayAgg, weekAgg] = await Promise.all([
      RiderEarning.aggregate([
        {
          $match: {
            riderId: req.user._id,
            creditedAt: { $gte: todayStart },
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
      RiderEarning.aggregate([
        {
          $match: {
            riderId: req.user._id,
            creditedAt: { $gte: weekStart },
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
      ]),
    ]);

    return res.json({
      wallet: {
        pendingBalance: wallet.pendingBalance || 0,
        availableBalance: wallet.availableBalance || 0,
        totalEarned: wallet.totalEarned || 0,
        totalWithdrawn: wallet.totalWithdrawn || 0,
        lastCreditedAt: wallet.lastCreditedAt || null,
      },
      summary: {
        todayEarnings: todayAgg[0]?.total || 0,
        todayDeliveries: todayAgg[0]?.count || 0,
        weekEarnings: weekAgg[0]?.total || 0,
        weekDeliveries: weekAgg[0]?.count || 0,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch rider wallet" });
  }
});

// GET /api/rider/earnings
router.get("/earnings", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const earnings = await RiderEarning.find({ riderId: req.user._id })
      .sort({ creditedAt: -1 })
      .limit(limit)
      .lean();
    return res.json(earnings);
  } catch (err) {
    return res.status(500).json({ error: "Failed to fetch rider earnings" });
  }
});

module.exports = router;
