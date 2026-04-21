const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const express = require("express");

let mongoServer;

// Create a test Express app with routes
function createTestApp() {
  const app = express();
  app.use(express.json());

  // Register routes
  const productRoutes = require("../routes/productRoutes");
  const orderRoutes = require("../routes/orderRoutes");
  const adminRoutes = require("../routes/adminRoutes");
  const authRoutes = require("../routes/authRoutes");

  app.use("/api/products", productRoutes);
  app.use("/api/orders", orderRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/auth", authRoutes);

  return app;
}

// Mock Firebase auth verification
jest.mock("../config/firebase", () => {
  const mockAuth = {
    verifyIdToken: jest.fn(),
  };
  return {
    auth: () => mockAuth,
    __mockAuth: mockAuth,
  };
});

// Helper: get the mock auth
function getMockAuth() {
  return require("../config/firebase").__mockAuth;
}

// Helper: set up mock token for a user
function mockUserToken(email, uid = "test-uid") {
  const mockAuth = getMockAuth();
  mockAuth.verifyIdToken.mockResolvedValue({ email, uid });
}

// Helper: make token fail
function mockInvalidToken() {
  const mockAuth = getMockAuth();
  mockAuth.verifyIdToken.mockRejectedValue(new Error("Invalid token"));
}

// Connect to in-memory MongoDB
async function setupTestDB() {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
}

// Cleanup
async function teardownTestDB() {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (mongoServer) await mongoServer.stop();
}

// Clear collections between tests
async function clearCollections() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

// Helper: create test user in DB
async function createTestUser(overrides = {}) {
  const User = require("../models/User");
  const defaults = {
    email: "test@example.com",
    password: "hashedpassword123",
    role: "customer",
    loyaltyTier: "none",
    loyaltyPoints: 0,
    totalOrders: 0,
  };
  return User.create({ ...defaults, ...overrides });
}

// Helper: create test product in DB
async function createTestProduct(overrides = {}) {
  const Product = require("../models/Product");
  const defaults = {
    p_id: Math.floor(Math.random() * 100000),
    name: "Test Product",
    description: "A test product",
    brand: "TestBrand",
    colour: "Blue",
    price: 1500,
    category: "Western",
    stock: 20,
    lowStockThreshold: 10,
  };
  return Product.create({ ...defaults, ...overrides });
}

module.exports = {
  createTestApp,
  setupTestDB,
  teardownTestDB,
  clearCollections,
  createTestUser,
  createTestProduct,
  mockUserToken,
  mockInvalidToken,
  getMockAuth,
};
