const express = require('express');
const router = express.Router();
const multer = require('multer');
const mongoose = require('mongoose');
const { protectJWT } = require('../middleware/authJWT');

// Multer memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage, 
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

/**
 * @route POST /api/upload
 * @desc Upload an image to GridFS
 * @access Private
 */
router.post('/', protectJWT, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const db = mongoose.connection.db;
    const bucket = new mongoose.mongo.GridFSBucket(db);
    
    const uploadStream = bucket.openUploadStream(req.file.originalname, {
      contentType: req.file.mimetype,
      metadata: { userId: req.user._id, type: 'refund_evidence' }
    });

    uploadStream.end(req.file.buffer);

    uploadStream.on('finish', () => {
      // Return a URL that can be used to view the image
      // Note: We'll use the existing product image route logic if possible, 
      // or create a generic one. For now, we return the ID.
      const imageUrl = `${process.env.BACKEND_URL || 'https://calidi-app-production.up.railway.app'}/api/products/image/${uploadStream.id}`;
      
      res.status(201).json({ 
        success: true, 
        imageId: uploadStream.id,
        url: imageUrl 
      });
    });

    uploadStream.on('error', (err) => {
      throw err;
    });

  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

module.exports = router;
