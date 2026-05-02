const express = require('express');
const router = express.Router();
const axios = require('axios');
const mongoose = require('mongoose');
const admin = require('../config/firebase');

const IMAGE_BASE = `${process.env.BACKEND_PUBLIC_URL || 'http://127.0.0.1:5001'}/api/products/image`;
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || "http://127.0.0.1:8000";

// Helper: stream all GridFS chunks for an image_id and return a Buffer
async function getImageBuffer(image_id) {
  if (!image_id) return null;
  const chunks = await mongoose.connection.db.collection('fs.chunks')
    .find({ files_id: image_id })
    .sort({ n: 1 })
    .toArray();
  if (!chunks.length) return null;
  return Buffer.concat(chunks.map(c => Buffer.isBuffer(c.data) ? c.data : Buffer.from(c.data.buffer)));
}

// Helper: strip HTML tags from description strings
function stripHtml(str) {
  if (!str) return "";
  return str.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

async function extractUserIdIfLoggedIn(req) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) return null;
    const idToken = header.split(" ")[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken?.uid || null;
  } catch {
    return null;
  }
}

async function saveBrowsingHistory(userId, productId) {
  try {
    if (!userId || !Number.isFinite(Number(productId))) return;
    const db = mongoose.connection.db;
    const col = db.collection("browsingHistory");
    const normalizedProductId = Number(productId);

    await col.insertOne({
      userId: String(userId),
      productId: normalizedProductId,
      viewedAt: new Date(),
    });

    // Keep only latest 20 viewed products per user.
    const toDelete = await col
      .find({ userId: String(userId) })
      .sort({ viewedAt: -1, _id: -1 })
      .skip(20)
      .project({ _id: 1 })
      .toArray();

    if (toDelete.length > 0) {
      await col.deleteMany({ _id: { $in: toDelete.map((d) => d._id) } });
    }
  } catch (err) {
    console.error("Browsing history save failed:", err.message);
  }
}

// Route for: GET /api/products
router.get('/', async (req, res) => {
  try {
    // Only return products that have an image stored in GridFS
    // Sort by newest first (highest p_id = most recently added)
    const products = await mongoose.connection.db.collection('products')
      .find({
        $or: [
          { image_id: { $exists: true, $ne: null } },
          { img: { $exists: true, $ne: "" } },
        ],
      })
      .sort({ p_id: -1 })
      .limit(200)
      .toArray();

    const result = products.map((product) => ({
      ...product,
      id: String(product._id),
      image: product.image_id ? `${IMAGE_BASE}/${product.p_id}` : (product.img ? product.img.replace('http://', 'https://') : undefined),
      description: stripHtml(product.description),
      sizes: ["S", "M", "L", "XL", "XXL"],
      stock: product.stock ?? 50,
    }));

    res.json(result);
  } catch (err) {
    console.error("Database Fetch Error:", err);
    res.status(500).json({ message: err.message });
  }
});

// Route for: GET /api/products/image/:p_id  (serves the actual image binary)
router.get('/image/:p_id', async (req, res) => {
  try {
    const p_id = Number(req.params.p_id);
    const product = await mongoose.connection.db.collection('products').findOne({ p_id });
    if (!product || !product.image_id) return res.status(404).send('Image not found');

    const imageBuffer = await getImageBuffer(product.image_id);
    if (!imageBuffer) return res.status(404).send('Image not found');

    res.set('Content-Type', 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(imageBuffer);
  } catch (err) {
    console.error("Image serve error:", err);
    res.status(500).send('Error');
  }
});

// Route for: GET /api/products/recommendations/:p_id
router.get('/recommendations/health', async (req, res) => {
  try {
    const pythonRes = await axios.get(`${PYTHON_SERVICE_URL}/health`, { timeout: 5000 });
    return res.json({
      ok: true,
      python: pythonRes.data,
      pythonServiceUrl: PYTHON_SERVICE_URL,
    });
  } catch (err) {
    return res.status(503).json({
      ok: false,
      error: "Python service offline",
      pythonServiceUrl: PYTHON_SERVICE_URL,
      detail: err.message,
    });
  }
});

// Route for: GET /api/products/recommendations/:p_id
router.get('/recommendations/:p_id', async (req, res) => {
  try {
    const { p_id } = req.params;
    console.log(`--- Proxying rec request for ID: ${p_id}`);

    const pythonRes = await axios.get(`${PYTHON_SERVICE_URL}/recommend`, {
      params: { product_id: p_id }
    });

    const recs = pythonRes.data;

    const enriched = await Promise.all(recs.map(async (rec) => {
      try {
        const product = await mongoose.connection.db.collection('products')
          .findOne({ p_id: Number(rec.p_id) });

        if (!product) return { ...rec, id: String(rec.p_id), sizes: ["S", "M", "L", "XL", "XXL"] };

        return {
          ...rec,
          id: String(product._id),
          name: product.name || rec.name,
          brand: product.brand || rec.brand,
          price: Number(product.price ?? rec.price ?? 0),
          image: product.image_id ? `${IMAGE_BASE}/${product.p_id}` : (product.img ? product.img.replace('http://', 'https://') : undefined),
          description: stripHtml(product.description || ""),
          category: product.category || "",
          sizes: ["S", "M", "L", "XL", "XXL"],
        };
      } catch {
        return { ...rec, id: String(rec.p_id), sizes: ["S", "M", "L", "XL", "XXL"] };
      }
    }));

    res.json(enriched);
  } catch (err) {
    const status = err?.response?.status;
    if (status === 404) {
      return res.json([]);
    }
    console.error("Bridge to Python failed:", err.message);
    res.status(503).json({ error: "Python service offline" });
  }
});

// Route for: GET /api/products/complete-look/:productId
router.get('/complete-look/:productId', async (req, res) => {
  try {
    const { productId } = req.params;

    const pythonRes = await axios.get(
      `${PYTHON_SERVICE_URL}/recommend/complete-look/${encodeURIComponent(String(productId))}`
    );

    const ids = Array.isArray(pythonRes.data) ? pythonRes.data : [];
    const enriched = [];

    for (const id of ids) {
      const idStr = String(id);
      let product = null;

      const pIdNum = Number(idStr);
      if (Number.isFinite(pIdNum)) {
        product = await mongoose.connection.db.collection('products').findOne({ p_id: pIdNum });
      }

      if (!product && mongoose.Types.ObjectId.isValid(idStr)) {
        product = await mongoose.connection.db.collection('products').findOne({ _id: new mongoose.Types.ObjectId(idStr) });
      }

      if (!product) continue;

      enriched.push({
        ...product,
        id: String(product._id),
        p_id: product.p_id,
        name: product.name || "Unknown",
        price: Number(product.price ?? 0),
        category: product.category || "",
        image: product.image_id ? `${IMAGE_BASE}/${product.p_id}` : (product.img ? product.img.replace('http://', 'https://') : undefined),
        description: stripHtml(product.description || ""),
        sizes: ["S", "M", "L", "XL", "XXL"],
        stock: product.stock ?? 50,
      });
    }

    return res.json(enriched);
  } catch (err) {
    console.error("Bridge to Python (complete look) failed:", err.message);
    return res.json([]);
  }
});

// Route for: GET /api/products/outfit/:productId
router.get('/outfit/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    const topN = Number(req.query.top_n || req.query.top || 4);

    const sourceConditions = [
      Number.isFinite(Number(productId)) ? { p_id: Number(productId) } : null,
      mongoose.Types.ObjectId.isValid(String(productId))
        ? { _id: new mongoose.Types.ObjectId(String(productId)) }
        : null,
    ].filter(Boolean);
    if (sourceConditions.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    const sourceProduct = await mongoose.connection.db.collection('products').findOne({
      $or: sourceConditions,
    });
    if (!sourceProduct) {
      return res.status(404).json({ error: "Product not found" });
    }

    const pythonRes = await axios.get(
      `${PYTHON_SERVICE_URL}/recommend/outfit/${encodeURIComponent(String(productId))}`,
      { params: { top_n: topN }, timeout: 5000 }
    );

    const payload = pythonRes.data || {};
    const recItems = Array.isArray(payload)
      ? payload
      : (Array.isArray(payload.items) ? payload.items : []);
    const enrichedItems = [];

    for (const rec of recItems) {
      const recProductId = String(rec?.productId || rec?.p_id || rec?.id || "").trim();
      if (!recProductId) continue;

      let product = null;
      if (mongoose.Types.ObjectId.isValid(recProductId)) {
        product = await mongoose.connection.db.collection('products').findOne({
          _id: new mongoose.Types.ObjectId(recProductId),
        });
      }
      if (!product && Number.isFinite(Number(recProductId))) {
        product = await mongoose.connection.db.collection('products').findOne({
          p_id: Number(recProductId),
        });
      }
      if (!product) continue;

      const normalizedProduct = {
        ...product,
        id: String(product._id),
        p_id: product.p_id,
        name: product.name || "Unknown",
        price: Number(product.price ?? 0),
        category: product.category || "",
        image: product.image_id ? `${IMAGE_BASE}/${product.p_id}` : (product.img ? product.img.replace('http://', 'https://') : undefined),
        description: stripHtml(product.description || ""),
        sizes: ["S", "M", "L", "XL", "XXL"],
        stock: product.stock ?? 50,
        outfitSlot: product.outfitSlot || "top",
        subCategory: product.subCategory || "Top",
      };

      enrichedItems.push({
        product: normalizedProduct,
        slot: String(rec?.slot || rec?.outfit_group || ""),
        subCategory: String(rec?.subCategory || normalizedProduct.subCategory || ""),
        concept: String(rec?.concept || ""),
      });
    }

    return res.json({
      outfitConcept: (Array.isArray(payload) ? null : (payload.outfitConcept || null)),
      items: enrichedItems,
    });
  } catch (err) {
    if (err?.code === "ECONNABORTED") {
      console.error("Outfit builder timeout:", err.message);
      return res.json({ outfitConcept: null, items: [] });
    }
    const status = Number(err?.response?.status || 0);
    if (status === 404) {
      return res.status(404).json({ error: "Product not found" });
    }
    console.error("Bridge to Python (outfit builder) failed:", err.message);
    return res.json({ outfitConcept: null, items: [] });
  }
});

// Route for: GET /api/products/recommendations/user/:userId
router.get('/recommendations/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const topN = Number(req.query.top_n || req.query.top || 8);

    const pythonRes = await axios.get(`${PYTHON_SERVICE_URL}/recommend/user/${encodeURIComponent(userId)}`, {
      params: { top_n: topN }
    });

    const recs = pythonRes.data;

    const enriched = await Promise.all(recs.map(async (rec) => {
      try {
        const pIdNum = Number(rec.p_id);
        const product = await mongoose.connection.db.collection('products')
          .findOne({ p_id: pIdNum });

        if (!product) {
          return {
            ...rec,
            id: String(rec.p_id),
            sizes: ["S", "M", "L", "XL", "XXL"],
          };
        }

        return {
          ...rec,
          id: String(product._id),
          p_id: product.p_id,
          name: product.name || rec.name,
          brand: product.brand || rec.brand,
          price: Number(product.price ?? rec.price ?? 0),
          image: product.image_id ? `${IMAGE_BASE}/${product.p_id}` : (product.img ? product.img.replace('http://', 'https://') : undefined),
          description: stripHtml(product.description || ""),
          category: product.category || "",
          stock: product.stock ?? 50,
          sizes: ["S", "M", "L", "XL", "XXL"],
        };
      } catch {
        return {
          ...rec,
          id: String(rec.p_id),
          sizes: ["S", "M", "L", "XL", "XXL"],
        };
      }
    }));

    res.json(enriched);
  } catch (err) {
    const status = err?.response?.status;
    if (status === 404) {
      return res.json([]);
    }
    console.error("Bridge to Python (user rec) failed:", err.message);
    res.status(503).json({ error: "Python user recommendation service offline" });
  }
});

// Route for: GET /api/products/recommendations/browsing/:userId
router.get('/recommendations/browsing/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const topN = Number(req.query.top_n || req.query.top || 8);

    const pythonRes = await axios.get(`${PYTHON_SERVICE_URL}/recommend/browsing/${encodeURIComponent(userId)}`, {
      params: { top_n: topN }
    });

    const recs = pythonRes.data;

    const enriched = await Promise.all(recs.map(async (rec) => {
      try {
        const pIdNum = Number(rec.p_id);
        const product = await mongoose.connection.db.collection('products')
          .findOne({ p_id: pIdNum });

        if (!product) {
          return {
            ...rec,
            id: String(rec.p_id),
            sizes: ["S", "M", "L", "XL", "XXL"],
          };
        }

        return {
          ...rec,
          id: String(product._id),
          p_id: product.p_id,
          name: product.name || rec.name,
          brand: product.brand || rec.brand,
          price: Number(product.price ?? rec.price ?? 0),
          image: product.image_id ? `${IMAGE_BASE}/${product.p_id}` : (product.img ? product.img.replace('http://', 'https://') : undefined),
          description: stripHtml(product.description || ""),
          category: product.category || "",
          stock: product.stock ?? 50,
          sizes: ["S", "M", "L", "XL", "XXL"],
        };
      } catch {
        return {
          ...rec,
          id: String(rec.p_id),
          sizes: ["S", "M", "L", "XL", "XXL"],
        };
      }
    }));

    res.json(enriched);
  } catch (err) {
    const status = err?.response?.status;
    if (status === 404) {
      return res.json([]);
    }
    console.error("Bridge to Python (browsing rec) failed:", err.message);
    res.status(503).json({ error: "Python browsing recommendation service offline" });
  }
});

// Route for: GET /api/products/:id  (single product by p_id)
router.get('/:id', async (req, res) => {
  try {
    const p_id = Number(req.params.id);
    const product = await mongoose.connection.db.collection('products').findOne({ p_id });
    if (!product) return res.status(404).json({ error: "Product not found" });
    const responsePayload = {
      ...product,
      id: String(product._id),
      image: product.image_id ? `${IMAGE_BASE}/${product.p_id}` : (product.img ? product.img.replace('http://', 'https://') : undefined),
      description: stripHtml(product.description),
      sizes: ["S", "M", "L", "XL", "XXL"],
      stock: product.stock ?? 50,
    };

    // Send product response immediately (do not block on browsing history writes).
    res.json(responsePayload);

    // Non-blocking browsing history tracking for logged-in users only.
    setImmediate(async () => {
      const userId = await extractUserIdIfLoggedIn(req);
      if (!userId) return;
      await saveBrowsingHistory(userId, p_id);
    });
  } catch (err) {
    console.error("Single product fetch error:", err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
