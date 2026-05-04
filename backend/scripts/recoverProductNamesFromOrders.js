/* eslint-disable no-console */
require("dotenv").config();
const mongoose = require("mongoose");
const Order = require("../models/Order");
const Product = require("../models/Product");

async function main() {
  const apply = process.argv.includes("--apply");

  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is missing in environment");
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  // Build name candidates from historical order items.
  const orders = await Order.find({}, { items: 1 }).lean();
  const perProduct = new Map(); // productId -> Map(name -> count)

  for (const order of orders) {
    for (const item of order.items || []) {
      const pId = Number(item.productId);
      const itemName = String(item.name || "").trim();
      if (!Number.isFinite(pId) || !itemName) continue;

      if (!perProduct.has(pId)) perProduct.set(pId, new Map());
      const nameCounts = perProduct.get(pId);
      nameCounts.set(itemName, (nameCounts.get(itemName) || 0) + 1);
    }
  }

  // Pick the most frequent historical name per productId.
  const bestNameByPid = new Map();
  for (const [pId, nameCounts] of perProduct.entries()) {
    let bestName = "";
    let bestCount = -1;
    for (const [name, count] of nameCounts.entries()) {
      if (count > bestCount) {
        bestName = name;
        bestCount = count;
      }
    }
    if (bestName) bestNameByPid.set(pId, bestName);
  }

  const products = await Product.find({}, { p_id: 1, name: 1 }).lean();
  const changes = [];

  for (const p of products) {
    const pId = Number(p.p_id);
    const currentName = String(p.name || "").trim();
    const recoveredName = bestNameByPid.get(pId);
    if (!recoveredName) continue;
    if (currentName === recoveredName) continue;

    changes.push({
      p_id: pId,
      from: currentName,
      to: recoveredName,
    });
  }

  console.log(`Found ${changes.length} recoverable name changes from order history.`);
  if (changes.length > 0) {
    console.table(changes.slice(0, 50));
    if (changes.length > 50) {
      console.log(`...and ${changes.length - 50} more`);
    }
  }

  if (!apply) {
    console.log("\nDry run only. Re-run with --apply to write changes.");
    await mongoose.disconnect();
    return;
  }

  let modified = 0;
  for (const c of changes) {
    const r = await Product.updateOne({ p_id: c.p_id }, { $set: { name: c.to } });
    modified += r.modifiedCount || 0;
  }

  console.log(`Applied ${modified} product name updates.`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("Recovery failed:", err.message);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});

