# Calidi Backend – API Documentation

Base URL: `http://localhost:5000/api`

---

## Health Check

### `GET /api/health`
Returns server status.

**Response:** `{ "status": "ok" }`

---

## Authentication

### `POST /api/auth/signup`
Create a new account. Sends a verification email.

**Body:**
```json
{ "email": "user@example.com", "password": "min6chars" }
```

**Responses:**
- `201` – `{ "message": "Account created. Please check your email to verify your account." }`
- `400` – Missing fields
- `409` – Email already registered

---

### `POST /api/auth/login`
Sign in with verified account. Returns JWT token.

**Body:**
```json
{ "email": "user@example.com", "password": "min6chars" }
```

**Responses:**
- `200` – `{ "token": "jwt...", "user": { "id": "...", "email": "..." } }`
- `401` – Invalid credentials
- `403` – Email not verified

---

### `GET /api/auth/verify-email?token=<token>`
Verify email address via token sent in verification email.

**Responses:**
- `200` – `{ "message": "Email verified successfully. You can now sign in." }`
- `400` – Invalid or expired token

---

### `GET /api/auth/me`
Get current authenticated user. **Requires Bearer token.**

**Headers:** `Authorization: Bearer <jwt>`

**Response:** `{ "user": { "id": "...", "email": "..." } }`

---

## Checkout

### `POST /api/checkout/create-session`
Create a Stripe Checkout session. **Requires Bearer token.**

**Headers:** `Authorization: Bearer <jwt>`

**Body:**
```json
{
  "lineItems": [
    { "name": "Linen Blazer (M)", "price": 245, "quantity": 1 }
  ],
  "shippingAddress": {
    "fullName": "Jane Doe",
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zip": "10001",
    "country": "US"
  }
}
```

**Responses:**
- `200` – `{ "url": "https://checkout.stripe.com/..." }`
- `400` – Empty cart
- `401` – Not authenticated
- `500` – Stripe error
