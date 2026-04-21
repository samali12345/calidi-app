const request = require("supertest");
const {
  createTestApp,
  setupTestDB,
  teardownTestDB,
  clearCollections,
  createTestUser,
  createTestProduct,
  mockUserToken,
} = require("./setup");
const Order = require("../models/Order");
const Product = require("../models/Product");

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

describe("Order Security", () => {
  test("should not allow unauthenticated order creation", async () => {
    const res = await request(app).post("/api/orders").send({
      items: [{ productId: 1, size: "M", quantity: 1 }],
      shippingAddress: { fullName: "Test", street: "123 St", city: "City", state: "State", zip: "10000", country: "LK" },
    });
    expect(res.status).toBe(401);
  });

  test("should decrement stock on order creation", async () => {
    const user = await createTestUser({ email: "buyer@example.com" });
    mockUserToken("buyer@example.com", "buyer-uid");
    const product = await createTestProduct({ p_id: 100, stock: 20 });

    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", "Bearer valid-token")
      .send({
        items: [{ productId: 100, size: "M", quantity: 3 }],
        shippingAddress: { fullName: "Test", street: "123 St", city: "City", state: "State", zip: "10000", country: "LK" },
      });

    expect(res.status).toBe(201);

    const updated = await Product.findOne({ p_id: 100 });
    expect(updated.stock).toBe(17);
  });

  test("should reject order when stock is insufficient", async () => {
    await createTestUser({ email: "buyer@example.com" });
    mockUserToken("buyer@example.com", "buyer-uid");
    await createTestProduct({ p_id: 200, stock: 2 });

    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", "Bearer valid-token")
      .send({
        items: [{ productId: 200, size: "M", quantity: 5 }],
        shippingAddress: { fullName: "Test", street: "123 St", city: "City", state: "State", zip: "10000", country: "LK" },
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/insufficient stock/i);
  });

  test("should restore stock on order cancellation", async () => {
    await createTestUser({ email: "buyer@example.com" });
    mockUserToken("buyer@example.com", "buyer-uid");
    await createTestProduct({ p_id: 300, stock: 10 });

    // Create order
    const createRes = await request(app)
      .post("/api/orders")
      .set("Authorization", "Bearer valid-token")
      .send({
        items: [{ productId: 300, size: "M", quantity: 3 }],
        shippingAddress: { fullName: "Test", street: "123 St", city: "City", state: "State", zip: "10000", country: "LK" },
      });

    expect(createRes.status).toBe(201);
    const orderId = createRes.body.orderId;

    // Cancel order
    const cancelRes = await request(app)
      .post(`/api/orders/${orderId}/cancel`)
      .set("Authorization", "Bearer valid-token");

    expect(cancelRes.status).toBe(200);

    const product = await Product.findOne({ p_id: 300 });
    expect(product.stock).toBe(10); // Stock restored
  });

  test("should not allow paying for expired order", async () => {
    await createTestUser({ email: "buyer@example.com" });
    mockUserToken("buyer@example.com", "buyer-uid");
    await createTestProduct({ p_id: 400, stock: 10 });

    // Create order with immediate expiry
    const order = await Order.create({
      orderId: "ORD-EXPIRED",
      userId: "buyer-uid",
      userEmail: "buyer@example.com",
      items: [{ productId: 400, name: "Test", size: "M", quantity: 1, unitPrice: 1500 }],
      shippingAddress: { fullName: "Test", street: "123", city: "City", state: "State", zip: "10000", country: "LK" },
      subtotal: 1500,
      total: 1850,
      deliveryFee: 350,
      expiresAt: new Date(Date.now() - 1000), // Already expired
    });

    const res = await request(app)
      .post("/api/orders/ORD-EXPIRED/pay")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/expired/i);
  });

  test("should not allow user to view other user's orders", async () => {
    await createTestUser({ email: "user1@example.com" });
    await createTestUser({ email: "user2@example.com" });

    // Create order for user1
    await Order.create({
      orderId: "ORD-USER1",
      userId: "user1-uid",
      userEmail: "user1@example.com",
      items: [{ productId: 1, name: "Test", size: "M", quantity: 1, unitPrice: 1500 }],
      shippingAddress: { fullName: "Test", street: "123", city: "City", state: "State", zip: "10000", country: "LK" },
      subtotal: 1500,
      total: 1500,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    // Try to access as user2
    mockUserToken("user2@example.com", "user2-uid");
    const res = await request(app)
      .get("/api/orders/ORD-USER1")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(403);
  });

  test("should not allow cancelling another user's order", async () => {
    await createTestUser({ email: "owner@example.com" });
    await createTestUser({ email: "attacker@example.com" });

    await Order.create({
      orderId: "ORD-VICTIM",
      userId: "owner-uid",
      userEmail: "owner@example.com",
      items: [{ productId: 1, name: "Test", size: "M", quantity: 1, unitPrice: 1500 }],
      shippingAddress: { fullName: "Test", street: "123", city: "City", state: "State", zip: "10000", country: "LK" },
      subtotal: 1500,
      total: 1500,
      status: "pending",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    mockUserToken("attacker@example.com", "attacker-uid");
    const res = await request(app)
      .post("/api/orders/ORD-VICTIM/cancel")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(403);
  });
});
