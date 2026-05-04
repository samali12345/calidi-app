const request = require("supertest");
const {
  createTestApp,
  setupTestDB,
  teardownTestDB,
  clearCollections,
  createTestUser,
  mockUserToken,
  mockInvalidToken,
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

describe("Authentication Security", () => {
  test("should return 401 when no token is provided", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/no token/i);
  });

  test("should return 401 when invalid token is provided", async () => {
    mockInvalidToken();
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer invalid-token");
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid token/i);
  });

  test("should return 401 when Authorization header format is wrong", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Token some-token");
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/no token/i);
  });

  test("should return user data with valid token", async () => {
    const user = await createTestUser({ email: "valid@example.com" });
    mockUserToken("valid@example.com", "uid-123");

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe("valid@example.com");
    expect(res.body.user.role).toBe("customer");
  });

  test("should auto-create user if not in DB", async () => {
    mockUserToken("newuser@example.com", "new-uid");

    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("newuser@example.com");
    expect(res.body.user.role).toBe("customer");
  });
});

describe("Role-Based Access Control", () => {
  test("should return 403 when non-admin accesses admin routes", async () => {
    await createTestUser({ email: "customer@example.com", role: "customer" });
    mockUserToken("customer@example.com", "customer-uid");

    const res = await request(app)
      .get("/api/admin/dashboard/stats")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/admin only/i);
  });

  test("should allow admin to access admin routes", async () => {
    await createTestUser({ email: "admin@example.com", role: "admin" });
    mockUserToken("admin@example.com", "admin-uid");

    const res = await request(app)
      .get("/api/admin/dashboard/stats")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
  });

  test("should return 401 for unauthenticated admin route access", async () => {
    const res = await request(app).get("/api/admin/dashboard/stats");
    expect(res.status).toBe(401);
  });

  test("should return 403 for all admin endpoints with customer role", async () => {
    await createTestUser({ email: "user@example.com", role: "customer" });
    mockUserToken("user@example.com", "user-uid");

    const endpoints = [
      "/api/admin/dashboard/stats",
      "/api/admin/dashboard/sales",
      "/api/admin/products",
      "/api/admin/orders",
      "/api/admin/customers",
      "/api/admin/reports/sales",
      "/api/admin/reports/stock",
    ];

    for (const endpoint of endpoints) {
      const res = await request(app)
        .get(endpoint)
        .set("Authorization", "Bearer valid-token");
      expect(res.status).toBe(403);
    }
  });
});
