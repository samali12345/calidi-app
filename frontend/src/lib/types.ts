export interface Product {
  id: string;
  p_id: number;
  name: string;
  price: number;
  category: string;
  image?: string;
  description: string;
  sizes: string[];
  p_attributes?: any;
  brand?: string;
  stock?: number;
  lowStockThreshold?: number;
  colour?: string;
  avg_rating?: number;
  ratingCount?: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
  size: string;
}

export interface OrderItem {
  productId: number;
  name: string;
  size: string;
  quantity: number;
  unitPrice: number;
}

export interface DeliveryDetails {
  recipientName: string;
  contactNumber: string;
  deliveryNotes: string;
  deliveryMethod: "standard" | "express" | "same-day";
  scheduledDate: string | null;
  scheduledTimeSlot: "morning" | "afternoon" | "evening" | "any";
}

export interface Order {
  _id: string;
  orderId: string;
  userId: string;
  userEmail: string;
  items: OrderItem[];
  shippingAddress: {
    fullName: string;
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  subtotal: number;
  discount: number;
  deliveryFee: number;
  total: number;
  loyaltyPointsEarned: number;
  loyaltyTierAtPurchase: string;
  status: "pending" | "paid" | "expired" | "cancelled";
  paymentMethod: string;
  expiresAt: string;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
  deliveryDetails?: DeliveryDetails;
  deliveryId?: string | null;
}

export interface DeliveryStatusEntry {
  status: string;
  timestamp: string;
  note: string;
}

export interface Delivery {
  _id: string;
  deliveryId: string;
  orderId: string;
  userId: string;
  userEmail: string;
  recipientName: string;
  contactNumber: string;
  deliveryAddress: {
    street: string;
    city: string;
    state: string;
    zip: string;
    country: string;
  };
  deliveryNotes: string;
  deliveryMethod: "standard" | "express" | "same-day";
  deliveryFee: number;
  scheduledDate: string | null;
  scheduledTimeSlot: "morning" | "afternoon" | "evening" | "any";
  status: "pending_pickup" | "in_transit" | "delivered" | "failed" | "returned";
  statusHistory: DeliveryStatusEntry[];
  deliveredAt: string | null;
  proofOfDelivery: string;
  currentLocation: string;
  etaMinutes: number | null;
  currentLat: number | null;
  currentLng: number | null;
  destinationLat: number | null;
  destinationLng: number | null;
  routePolyline?: string;
  liveUpdatedAt: string | null;
  itemCount: number;
  orderTotal: number;
  riderId?:
    | string
    | {
        _id: string;
        name?: string;
        email?: string;
        mobileNumber?: string;
        isAvailable?: boolean;
      }
    | null;
  assignedAt?: string | null;
  vehicleType?: "bike" | "threewheel" | "van" | "unknown";
  orderDetails?: {
    itemCount: number;
    items?: Array<{
      name: string;
      size: string;
      quantity: number;
      unitPrice: number;
    }>;
    deliveryAddress: {
      street: string;
      city: string;
      state: string;
      zip: string;
      country: string;
    } | null;
    zone: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Rider {
  _id: string;
  name?: string;
  email: string;
  mobileNumber?: string;
  phone?: string;
  isAvailable: boolean;
  vehicleType?: "bike" | "threewheel" | "van" | "unknown";
  role: "rider";
  riderApprovalStatus?: "none" | "pending" | "approved" | "rejected";
  riderAppliedAt?: string | null;
  activeDelivery?: Delivery | null;
  createdAt: string;
}

export interface RiderWallet {
  pendingBalance: number;
  availableBalance: number;
  totalEarned: number;
  totalWithdrawn: number;
  lastCreditedAt: string | null;
}

export interface RiderWalletSummary {
  todayEarnings: number;
  todayDeliveries: number;
  weekEarnings: number;
  weekDeliveries: number;
}

export interface RiderEarning {
  _id: string;
  riderId: string;
  deliveryId: string;
  orderId: string;
  amount: number;
  status: "pending" | "available" | "paid";
  note: string;
  creditedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryMethod {
  id: string;
  name: string;
  description: string;
  fee: number;
  available: boolean;
}

export interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  lowStockCount: number;
}

export interface SalesDataPoint {
  date: string;
  revenue: number;
  orderCount: number;
}
