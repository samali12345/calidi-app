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
const User = require("../models/User");
const Coupon = require("../models/Coupon");
const CartActivity = require("../models/CartActivity");

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

describe("Loyalty Redemption", () => {
  test("should apply points redemption and deduct on payment", async () => {
    await createTestUser({
      email: "redeem@example.com",
      loyaltyPoints: 200,
      loyaltyTier: "silver",
      totalOrders: 4,
    });
    mockUserToken("redeem@example.com", "redeem-uid");
    await createTestProduct({ p_id: 501, price: 1000, stock: 10 });

    const createRes = await request(app)
      .post("/api/orders")
      .set("Authorization", "Bearer valid-token")
      .send({
        redeemPoints: 100,
        items: [{ productId: 501, size: "M", quantity: 2 }],
        shippingAddress: {
          fullName: "Redeem User",
          street: "123 St",
          city: "City",
          state: "State",
          zip: "10000",
          country: "LK",
        },
        deliveryDetails: {
          recipientName: "Redeem User",
          contactNumber: "+94770000000",
          deliveryNotes: "",
          deliveryMethod: "standard",
          scheduledDate: null,
          scheduledTimeSlot: "any",
        },
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.tierDiscount).toBe(200);
    expect(createRes.body.pointsDiscount).toBe(100);
    expect(createRes.body.discount).toBe(300);
    expect(createRes.body.pointsRedemptionStatus).toBe("pending");

    const payRes = await request(app)
      .post(`/api/orders/${createRes.body.orderId}/pay`)
      .set("Authorization", "Bearer valid-token");

    expect(payRes.status).toBe(200);

    const updatedUser = await User.findOne({ email: "redeem@example.com" });
    expect(updatedUser.loyaltyPoints).toBe(120); // 200 - 100 + floor(2050/100)
    expect(updatedUser.totalOrders).toBe(5);
    expect(updatedUser.loyaltyTier).toBe("silver");

    const paidOrder = await Order.findOne({ orderId: createRes.body.orderId });
    expect(paidOrder.pointsRedemptionStatus).toBe("deducted");
  });

  test("should reject redemption above 50% of subtotal", async () => {
    await createTestUser({
      email: "cap@example.com",
      loyaltyPoints: 500,
    });
    mockUserToken("cap@example.com", "cap-uid");
    await createTestProduct({ p_id: 502, price: 1000, stock: 10 });

    const res = await request(app)
      .post("/api/orders")
      .set("Authorization", "Bearer valid-token")
      .send({
        redeemPoints: 600,
        items: [{ productId: 502, size: "M", quantity: 1 }],
        shippingAddress: {
          fullName: "Cap User",
          street: "123 St",
          city: "City",
          state: "State",
          zip: "10000",
          country: "LK",
        },
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/at most/i);
  });

  test("should apply coupon discount and mark usage on payment", async () => {
    await createTestUser({
      email: "coupon@example.com",
      loyaltyPoints: 0,
      loyaltyTier: "none",
      totalOrders: 0,
    });
    await Coupon.create({
      code: "CALIDI10",
      discountType: "percentage",
      discountValue: 10,
      minOrderValue: 500,
      maxUses: 5,
      usedCount: 0,
      isActive: true,
      usedBy: [],
    });
    mockUserToken("coupon@example.com", "coupon-uid");
    await createTestProduct({ p_id: 503, price: 1000, stock: 10 });

    const createRes = await request(app)
      .post("/api/orders")
      .set("Authorization", "Bearer valid-token")
      .send({
        couponCode: "calidi10",
        items: [{ productId: 503, size: "M", quantity: 2 }],
        shippingAddress: {
          fullName: "Coupon User",
          street: "123 St",
          city: "City",
          state: "State",
          zip: "10000",
          country: "LK",
        },
        deliveryDetails: {
          recipientName: "Coupon User",
          contactNumber: "+94771111111",
          deliveryNotes: "",
          deliveryMethod: "standard",
          scheduledDate: null,
          scheduledTimeSlot: "any",
        },
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.couponCode).toBe("CALIDI10");
    expect(createRes.body.couponDiscount).toBe(200);
    expect(createRes.body.total).toBe(2150); // 2000 - 200 + 350

    const payRes = await request(app)
      .post(`/api/orders/${createRes.body.orderId}/pay`)
      .set("Authorization", "Bearer valid-token");
    expect(payRes.status).toBe(200);

    const coupon = await Coupon.findOne({ code: "CALIDI10" });
    expect(coupon.usedCount).toBe(1);
    expect(coupon.usedBy).toContain("coupon-uid");
  });
});

describe("Abandoned Cart Activity", () => {
  test("should upsert cart activity for logged-in user", async () => {
    await createTestUser({ email: "cart@example.com" });
    mockUserToken("cart@example.com", "cart-uid");

    const res = await request(app)
      .post("/api/cart/activity")
      .set("Authorization", "Bearer valid-token")
      .send({
        items: [{ productId: 101, quantity: 2, unitPrice: 1200 }],
        totalValue: 2400,
      });

    expect(res.status).toBe(200);

    const activity = await CartActivity.findOne({ userId: "cart-uid" });
    expect(activity).toBeTruthy();
    expect(activity.totalValue).toBe(2400);
    expect(activity.notificationSent).toBe(false);
  });

  test("should clear cart activity when order is created", async () => {
    await createTestUser({ email: "cartclear@example.com" });
    mockUserToken("cartclear@example.com", "cartclear-uid");
    await createTestProduct({ p_id: 601, stock: 10, price: 1000 });

    await CartActivity.create({
      userId: "cartclear-uid",
      userEmail: "cartclear@example.com",
      items: [{ productId: 601, quantity: 1 }],
      totalValue: 1000,
      notificationSent: false,
      lastUpdatedAt: new Date(),
    });

    const createRes = await request(app)
      .post("/api/orders")
      .set("Authorization", "Bearer valid-token")
      .send({
        items: [{ productId: 601, size: "M", quantity: 1 }],
        shippingAddress: {
          fullName: "Cart Clear User",
          street: "123 St",
          city: "City",
          state: "State",
          zip: "10000",
          country: "LK",
        },
      });

    expect(createRes.status).toBe(201);

    const activityAfter = await CartActivity.findOne({ userId: "cartclear-uid" });
    expect(activityAfter).toBeNull();
  });
});
