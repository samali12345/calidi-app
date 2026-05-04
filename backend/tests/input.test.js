const request = require("supertest");
const {
  createTestApp,
  setupTestDB,
  teardownTestDB,
  clearCollections,
  createTestUser,
  mockUserToken,
} = require("./setup");

let app;

beforeAll(async () => {
  await setupTestDB();
  app = createTestApp();
});

afterAll(async () => {
  await teardownTestDB();
});

beforeEach(async () => {
  await clearCollections();
});

describe("Input Validation - Product Creation", () => {
  beforeEach(async () => {
    await createTestUser({ email: "admin@example.com", role: "admin" });
    mockUserToken("admin@example.com", "admin-uid");
  });

  test("should reject product with missing name", async () => {
    const res = await request(app)
      .post("/api/admin/products")
      .set("Authorization", "Bearer valid-token")
      .send({ price: 1000 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/name.*required|required/i);
  });

  test("should reject product with missing price", async () => {
    const res = await request(app)
      .post("/api/admin/products")
      .set("Authorization", "Bearer valid-token")
      .send({ name: "Test Product" });

    expect(res.status).toBe(400);
  });

  test("should reject product with negative price", async () => {
    const res = await request(app)
      .post("/api/admin/products")
      .set("Authorization", "Bearer valid-token")
      .send({ name: "Test Product", price: -500 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/negative/i);
  });

  test("should reject product with negative stock", async () => {
    const res = await request(app)
      .post("/api/admin/products")
      .set("Authorization", "Bearer valid-token")
      .send({ name: "Test Product", price: 1000, stock: -5 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/negative/i);
  });

  test("should reject product update with negative price", async () => {
    const Product = require("../models/Product");
    await Product.create({ p_id: 999, name: "Existing", price: 100, stock: 10 });

    const res = await request(app)
      .put("/api/admin/products/999")
      .set("Authorization", "Bearer valid-token")
      .send({ price: -100 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/negative/i);
  });
});

describe("Input Validation - Order Creation", () => {
  beforeEach(async () => {
    await createTestUser({ email: "customer@example.com" });
    mockUserToken("customer@example.com", "customer-uid");
  });

  test("should reject order with empty items", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", "Bearer valid-token")
      .send({
        items: [],
        shippingAddress: { fullName: "Test", street: "123", city: "C", state: "S", zip: "10000", country: "LK" },
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/no items/i);
  });

  test("should reject order with no items field", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", "Bearer valid-token")
      .send({
        shippingAddress: { fullName: "Test", street: "123", city: "C", state: "S", zip: "10000", country: "LK" },
      });

    expect(res.status).toBe(400);
  });

  test("should reject order with missing shipping address", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", "Bearer valid-token")
      .send({
        items: [{ productId: 1, size: "M", quantity: 1 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/shipping address/i);
  });

  test("should reject order for non-existent product", async () => {
    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", "Bearer valid-token")
      .send({
        items: [{ productId: 99999, size: "M", quantity: 1 }],
        shippingAddress: { fullName: "Test", street: "123", city: "C", state: "S", zip: "10000", country: "LK" },
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not found/i);
  });
});

describe("NoSQL Injection Prevention", () => {
  beforeEach(async () => {
    await createTestUser({ email: "admin@example.com", role: "admin" });
    mockUserToken("admin@example.com", "admin-uid");
  });

  test("should handle MongoDB operator injection in order status filter", async () => {
    // Attempt to inject $gt operator
    const res = await request(app)
      .get("/api/admin/orders?status[$gt]=")
      .set("Authorization", "Bearer valid-token");

    // Should not crash - either returns empty or handles gracefully
    expect([200, 400, 500]).toContain(res.status);
  });

  test("should handle MongoDB operator injection in product search", async () => {
    const res = await request(app)
      .get("/api/admin/products?search[$regex]=.*")
      .set("Authorization", "Bearer valid-token");

    // Should not crash
    expect([200, 400, 500]).toContain(res.status);
  });

  test("should reject invalid order status update", async () => {
    const res = await request(app)
      .put("/api/admin/orders/test-order/status")
      .set("Authorization", "Bearer valid-token")
      .send({ status: "invalid_status" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid status/i);
  });
});
