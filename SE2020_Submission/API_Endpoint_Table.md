# API ENDPOINT SPECIFICATION: CALIDI BOUTIQUE

| CATEGORY | METHOD | ENDPOINT | DESCRIPTION | AUTH |
| :--- | :--- | :--- | :--- | :--- |
| **USER** | `POST` | `/api/auth/signup` | New Customer Registration | No |
| **USER** | `POST` | `/api/auth/login` | Secure JWT Login | No |
| **USER** | `GET` | `/api/auth/me` | Profile & Loyalty Info | Yes |
| **USER** | `DELETE`| `/api/auth/account` | Remove User Account | Yes |
| **PRODUCT** | `GET` | `/api/products` | Public Catalog List | No |
| **PRODUCT** | `POST` | `/api/admin/products` | Create Product (Admin) | Admin |
| **PRODUCT** | `PUT` | `/api/admin/products/:id` | Update Stock/Catalog | Admin |
| **PRODUCT** | `DELETE`| `/api/admin/products/:id` | Remove Product (Admin) | Admin |
| **ORDER** | `POST` | `/api/orders` | Checkout & Reserve Stock | Yes |
| **ORDER** | `POST` | `/api/orders/:id/pay` | Process Payment | Yes |
| **ORDER** | `GET` | `/api/orders` | User Purchase History | Yes |
| **ORDER** | `PUT` | `/api/admin/orders/:id` | Update Status (Admin) | Admin |
| **REFUND** | `POST` | `/api/refunds/request/:id` | Submit Refund Request | Yes |
| **REFUND** | `GET` | `/api/admin/refunds` | View Pending Requests | Admin |
| **REFUND** | `PUT` | `/api/admin/refunds/:id` | Approve/Reject Refund | Admin |
| **REFUND** | `GET` | `/api/refunds/status/:id` | Track Refund Progress | Yes |
