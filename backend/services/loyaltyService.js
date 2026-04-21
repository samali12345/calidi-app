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

function calculatePoints(totalAmount) {
  return Math.floor(totalAmount / 100);
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

module.exports = {
  calculateTier,
  calculateDiscount,
  calculatePoints,
  getDeliveryFee,
  getTierInfo,
};
