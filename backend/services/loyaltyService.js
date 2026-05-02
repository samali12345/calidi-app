const { getDoublePointsStatus } = require("./doublePointsService");

function calculateTier(totalOrders) {
  if (totalOrders >= 15) return "gold";
  if (totalOrders >= 5) return "silver";
  return "none";
}

function calculateDiscount(tier, subtotal) {
  if (tier === "gold") return Math.round(subtotal * 0.15);
  if (tier === "silver") return Math.round(subtotal * 0.1);
  return 0;
}

async function calculatePoints(totalAmount) {
  const basePoints = Math.floor(totalAmount / 100);
  if (basePoints <= 0) return 0;
  const doublePoints = await getDoublePointsStatus();
  return doublePoints.active ? basePoints * 2 : basePoints;
}

function getTierDiscountPercent(tier) {
  if (tier === "gold") return 15;
  if (tier === "silver") return 10;
  return 0;
}

function getDeliveryFee(totalItems) {
  return totalItems >= 5 ? 0 : 350;
}

function getTierInfo(tier) {
  const tiers = {
    none: { name: "Standard", discount: "0%", nextTier: "Silver", ordersNeeded: 5 },
    silver: { name: "Silver", discount: "10%", nextTier: "Gold", ordersNeeded: 15 },
    gold: { name: "Gold", discount: "15%", nextTier: null, ordersNeeded: null },
  };
  return tiers[tier] || tiers.none;
}

function getTierProgress(totalOrders = 0, loyaltyTier) {
  const safeOrders = Number.isFinite(Number(totalOrders)) ? Math.max(0, Number(totalOrders)) : 0;
  const tier = loyaltyTier || calculateTier(safeOrders);

  if (tier === "gold") {
    return {
      nextTier: null,
      nextTierThreshold: null,
      ordersToNextTier: 0,
      nextTierDiscount: null,
      currentTierDiscount: getTierDiscountPercent("gold"),
      currentTierMin: 15,
      progressPercent: 100,
    };
  }

  if (tier === "silver") {
    const nextTierThreshold = 15;
    const currentTierMin = 5;
    const ordersToNextTier = Math.max(0, nextTierThreshold - safeOrders);
    const progressPercent = Math.max(
      0,
      Math.min(100, ((safeOrders - currentTierMin) / (nextTierThreshold - currentTierMin)) * 100)
    );
    return {
      nextTier: "gold",
      nextTierThreshold,
      ordersToNextTier,
      nextTierDiscount: getTierDiscountPercent("gold"),
      currentTierDiscount: getTierDiscountPercent("silver"),
      currentTierMin,
      progressPercent,
    };
  }

  const nextTierThreshold = 5;
  const currentTierMin = 0;
  const ordersToNextTier = Math.max(0, nextTierThreshold - safeOrders);
  const progressPercent = Math.max(
    0,
    Math.min(100, ((safeOrders - currentTierMin) / (nextTierThreshold - currentTierMin)) * 100)
  );

  return {
    nextTier: "silver",
    nextTierThreshold,
    ordersToNextTier,
    nextTierDiscount: getTierDiscountPercent("silver"),
    currentTierDiscount: getTierDiscountPercent("none"),
    currentTierMin,
    progressPercent,
  };
}

module.exports = {
  calculateTier,
  calculateDiscount,
  calculatePoints,
  getTierDiscountPercent,
  getDeliveryFee,
  getTierInfo,
  getTierProgress,
};
