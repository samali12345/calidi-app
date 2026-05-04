const express = require("express");
const router = express.Router();
const axios = require("axios");

// Point this to where your Python FastAPI service is running
const PYTHON_SERVICE_URL = process.env.PYTHON_SERVICE_URL || "http://localhost:8000";

router.get("/:id", async (req, res) => {
  try {
    const productId = req.params.id;
    // Call the Python FastAPI service
    const response = await axios.get(`${PYTHON_SERVICE_URL}/recommend/${productId}`);
    res.json(response.data);
  } catch (error) {
    console.error("Recommendation Error:", error.message);
    res.status(error.response?.status || 500).json({ 
      error: "Failed to fetch recommendations",
      details: error.message 
    });
  }
});

module.exports = router;