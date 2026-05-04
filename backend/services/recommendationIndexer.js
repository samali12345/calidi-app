const Product = require("../models/Product");

const RECOMMENDER_SERVICE_URL = process.env.PYTHON_SERVICE_URL || "http://127.0.0.1:8000";
const BACKEND_PUBLIC_URL = process.env.BACKEND_PUBLIC_URL || `http://127.0.0.1:${process.env.PORT || 5000}`;
const RETRY_INTERVAL_MS = Number(process.env.RECOMMENDER_RETRY_INTERVAL_MS || 30000);
const RETRY_BATCH_SIZE = Number(process.env.RECOMMENDER_RETRY_BATCH_SIZE || 25);

let syncInterval = null;
let syncInProgress = false;

async function isRecommenderHealthy() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);
  try {
    const response = await fetch(`${RECOMMENDER_SERVICE_URL}/health`, {
      method: "GET",
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function buildVectorizePayload(product) {
  return {
    p_id: String(product.p_id),
    name: product.name || "",
    description: product.description || "",
    p_attributes: product.p_attributes || "",
    brand: product.brand || "",
    colour: product.colour || "",
    price: Number(product.price || 0),
    ratingCount: Number(product.ratingCount || 0),
    avg_rating: Number(product.avg_rating || 0),
    image_url: product.image_id ? `${BACKEND_PUBLIC_URL}/api/products/image/${product.p_id}` : null,
  };
}

async function markIndexedState(product, state) {
  // Use _id to avoid Number cast issues when legacy rows have invalid p_id values.
  if (product && product._id) {
    await Product.updateOne({ _id: product._id }, { $set: state });
    return;
  }
  if (product && Number.isFinite(Number(product.p_id))) {
    await Product.updateOne({ p_id: Number(product.p_id) }, { $set: state });
  }
}

async function indexSingleProduct(product) {
  if (!product || product.p_id === undefined || product.p_id === null) {
    return { ok: false, reason: "missing_product" };
  }
  const numericPid = Number(product.p_id);
  if (!Number.isFinite(numericPid)) {
    await markIndexedState(product, {
      // Mark invalid rows as finalized so they do not block retry batches forever.
      aiIndexed: true,
      aiIndexedAt: null,
      aiIndexError: "Invalid p_id; skipped by recommendation indexer",
    });
    return { ok: false, reason: "invalid_p_id" };
  }

  const payload = buildVectorizePayload(product);

  try {
    const response = await fetch(`${RECOMMENDER_SERVICE_URL}/vectorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const raw = await response.text();
    let body = null;
    try {
      body = raw ? JSON.parse(raw) : null;
    } catch {
      body = null;
    }

    if (!response.ok) {
      const msg = `HTTP ${response.status}: ${raw || "vectorize failed"}`;
      await markIndexedState(product, { aiIndexed: false, aiIndexError: msg, aiIndexedAt: null });
      return { ok: false, reason: msg };
    }

    const status = body?.status;
    if (status === "indexed" || status === "already_indexed") {
      await markIndexedState(product, {
        aiIndexed: true,
        aiIndexedAt: new Date(),
        aiIndexError: "",
      });
      return { ok: true, reason: status };
    }

    const msg = `Unexpected vectorize response: ${raw || "unknown"}`;
    await markIndexedState(product, { aiIndexed: false, aiIndexError: msg, aiIndexedAt: null });
    return { ok: false, reason: msg };
  } catch (err) {
    const msg = `Request error: ${err.message}`;
    await markIndexedState(product, { aiIndexed: false, aiIndexError: msg, aiIndexedAt: null });
    return { ok: false, reason: msg };
  }
}

async function syncPendingProducts() {
  if (syncInProgress) return;
  syncInProgress = true;
  try {
    const healthy = await isRecommenderHealthy();
    if (!healthy) {
      console.warn("Recommendation index sync skipped: recommender service is offline.");
      return;
    }

    const pending = await Product.find({
      image_id: { $exists: true, $ne: null },
      aiIndexed: { $ne: true },
      p_id: { $type: "number" },
      $expr: { $eq: ["$p_id", "$p_id"] }, // excludes NaN
    })
      // Prioritize newest admin products first (highest p_id).
      .sort({ p_id: -1 })
      .limit(RETRY_BATCH_SIZE)
      .lean();

    for (const product of pending) {
      const result = await indexSingleProduct(product);
      if (!result.ok) {
        console.error(`Recommendation index retry failed for p_id=${product.p_id}: ${result.reason}`);
      }
    }
  } catch (err) {
    console.error("Recommendation index sync failed:", err.message);
  } finally {
    syncInProgress = false;
  }
}

function startRecommendationIndexer() {
  if (syncInterval) return;
  // Kick off immediate sync once at startup.
  syncPendingProducts().catch((err) => {
    console.error("Initial recommendation sync error:", err.message);
  });
  // Keep retrying pending items in background.
  syncInterval = setInterval(() => {
    syncPendingProducts().catch((err) => {
      console.error("Scheduled recommendation sync error:", err.message);
    });
  }, RETRY_INTERVAL_MS);
}

module.exports = {
  indexSingleProduct,
  startRecommendationIndexer,
  syncPendingProducts,
};
