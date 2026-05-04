const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
// Uses GOOGLE_APPLICATION_CREDENTIALS env var pointing to the service account JSON file
// OR you can pass the service account key inline
if (!admin.apps.length) {
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;

  if (serviceAccountPath) {
    const path = require('path');
    const resolvedPath = path.resolve(__dirname, '..', serviceAccountPath);
    const serviceAccount = require(resolvedPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    // Fallback: initialize with project ID only (works if running on Google Cloud)
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
  }
}

module.exports = admin;
