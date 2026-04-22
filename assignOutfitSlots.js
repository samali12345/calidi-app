const fs = require("fs");
const path = require("path");
const mongoose = require(path.join(__dirname, "backend", "node_modules", "mongoose"));

function loadEnv() {
  const envPaths = [
    path.join(__dirname, ".env"),
    path.join(__dirname, "backend", ".env"),
  ];
  for (const envPath of envPaths) {
    if (!fs.existsSync(envPath)) continue;
    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx < 0) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  }
}

function hasAny(text, keywords) {
  return keywords.some((k) => text.includes(k));
}

function detectOutfitSlot(name) {
  const text = String(name || "").toLowerCase();

  const bottomKeywords = [
    "skirt", "jeans", "jean", "shorts", "short", "trouser", "pant", "palazzo",
    "legging", "churidar", "bottom", "flared trouser", "straight fit",
    "high-rise", "loose fit", "slim fit", "wide leg",
  ];
  const dressKeywords = [
    "anarkali", "gown", "maxi", "jumpsuit", "coord", "co-ord", "set",
    "dungaree", "playsuit", "romper", "sharara set", "salwar",
  ];
  const topKeywords = [
    "top", "blouse", "shirt", "bralette", "crop", "kurti", "kurta", "tunic",
    "peplum", "wrap top", "sports top", "tank", "camisole", "tee", "t-shirt",
    "sweatshirt", "sweater", "pullover", "shrug", "cardigan",
  ];
  const accessoryKeywords = [
    "dupatta", "stole", "scarf", "bag", "purse", "clutch", "belt",
    "jewel", "earring", "necklace", "bracelet", "watch",
  ];
  const outerwearKeywords = [
    "jacket", "blazer", "coat", "overcoat", "windbreaker", "hoodie",
  ];

  if (hasAny(text, bottomKeywords)) return { slot: "bottom", usedDefault: false };
  if (hasAny(text, dressKeywords)) return { slot: "dress", usedDefault: false };
  if (hasAny(text, topKeywords)) return { slot: "top", usedDefault: false };
  if (hasAny(text, accessoryKeywords)) return { slot: "accessory", usedDefault: false };
  if (hasAny(text, outerwearKeywords)) return { slot: "outerwear", usedDefault: false };
  return { slot: "top", usedDefault: true };
}

function detectSubCategory(name) {
  const text = String(name || "").toLowerCase();
  if (text.includes("anarkali")) return "Anarkali";
  if (text.includes("kurta") || text.includes("kurti")) return "Kurta";
  if (text.includes("top") || text.includes("peplum") || text.includes("wrap top") || text.includes("sports top")) return "Top";
  if (text.includes("blouse")) return "Blouse";
  if (text.includes("tunic")) return "Tunic";
  if (text.includes("skirt")) return "Skirt";
  if (text.includes("jeans") || text.includes("jean")) return "Jeans";
  if (text.includes("shorts") || text.includes("short")) return "Shorts";
  if (text.includes("trouser") || text.includes("pant")) return "Trousers";
  if (text.includes("palazzo")) return "Palazzo";
  if (text.includes("legging") || text.includes("churidar")) return "Leggings";
  if (text.includes("jumpsuit")) return "Jumpsuit";
  if (text.includes("set") || text.includes("coord")) return "Co-ord Set";
  if (text.includes("dupatta")) return "Dupatta";
  if (text.includes("jacket") || text.includes("blazer")) return "Jacket";
  return "Top";
}

async function main() {
  loadEnv();
  const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
  if (!MONGO_URI) {
    throw new Error("MONGO_URI / MONGODB_URI not found in .env");
  }

  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  const products = await db
    .collection("products")
    .find({}, { projection: { _id: 1, name: 1 } })
    .toArray();

  const counts = {
    top: 0,
    bottom: 0,
    dress: 0,
    accessory: 0,
    outerwear: 0,
    default: 0,
    total: products.length,
  };

  for (const product of products) {
    const name = String(product.name || "").trim();
    const { slot, usedDefault } = detectOutfitSlot(name);
    const subCategory = detectSubCategory(name);

    await db.collection("products").updateOne(
      { _id: product._id },
      { $set: { outfitSlot: slot, subCategory } }
    );

    counts[slot] += 1;
    if (usedDefault) counts.default += 1;
    console.log(`${name} -> ${slot} / ${subCategory}`);
  }

  console.log(
    `tops: ${counts.top}, bottoms: ${counts.bottom}, dresses: ${counts.dress}, accessories: ${counts.accessory}, outerwear: ${counts.outerwear}, default: ${counts.default} - Total: ${counts.total}`
  );

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("ERROR:", err.message);
  try {
    await mongoose.disconnect();
  } catch (_) {}
  process.exit(1);
});
