import { useState, useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Package, Clock, CheckCircle, XCircle, AlertCircle, Truck } from "lucide-react";
import type { Order, Delivery } from "@/lib/types";

const statusConfig: Record<string, { icon: React.ReactNode; color: string; label: string }> = {
  pending: { icon: <Clock size={14} />, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400", label: "Pending" },
  paid: { icon: <CheckCircle size={14} />, color: "text-green-600 bg-green-50 dark:bg-green-950/30 dark:text-green-400", label: "Paid" },
  expired: { icon: <AlertCircle size={14} />, color: "text-gray-500 bg-gray-50 dark:bg-gray-900/30 dark:text-gray-400", label: "Expired" },
  cancelled: { icon: <XCircle size={14} />, color: "text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400", label: "Cancelled" },
};

const deliveryStatusLabels: Record<string, { label: string; color: string }> = {
  pending_pickup: { label: "Pending Pickup", color: "text-amber-600" },
  in_transit: { label: "In Transit", color: "text-blue-600" },
  delivered: { label: "Delivered", color: "text-green-600" },
  failed: { label: "Failed", color: "text-red-600" },
  returned: { label: "Returned", color: "text-gray-600" },
};

export default function OrderHistory() {
  const { user, token, loading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [deliveries, setDeliveries] = useState<Record<string, Delivery>>({});
  const [loadingOrders, setLoadingOrders] = useState(true);

  useEffect(() => {
    if (!token) return;
    apiFetch<Order[]>("/orders", { token })
      .then((orderData) => {
        setOrders(orderData);
        // Fetch delivery info for paid orders
        const paidOrders = orderData.filter((o) => o.status === "paid" && o.deliveryId);
        paidOrders.forEach((order) => {
          if (order.deliveryId) {
            apiFetch<Delivery>(`/deliveries/${order.deliveryId}`, { token })
              .then((del) => {
                setDeliveries((prev) => ({ ...prev, [order.orderId]: del }));
              })
              .catch(() => {});
          }
        });
      })
      .catch(() => toast.error("Failed to load orders"))
      .finally(() => setLoadingOrders(false));
  }, [token]);

  if (!loading && !user) return <Navigate to="/auth" />;

  const handleCancel = async (orderId: string) => {
    if (!token) return;
    try {
      await apiFetch(`/orders/${orderId}/cancel`, { method: "POST", token });
      setOrders((prev) => prev.map((o) => (o.orderId === orderId ? { ...o, status: "cancelled" } : o)));
      toast.success("Order cancelled");
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel");
    }
  };

  return (
    <main className="min-h-[70vh] py-12 px-6">
      <div className="container mx-auto max-w-3xl">
        <h1 className="font-display text-3xl font-bold tracking-wider text-foreground mb-10">
          Order History
        </h1>

        {loadingOrders ? (
          <p className="font-body text-muted-foreground">Loading orders...</p>
        ) : orders.length === 0 ? (
          <div className="text-center space-y-4 py-16">
            <Package size={48} className="mx-auto text-muted-foreground" />
            <p className="font-body text-muted-foreground">No orders yet</p>
            <Button asChild variant="outline" className="rounded-sm font-body uppercase tracking-widest text-sm">
              <Link to="/shop">Start Shopping</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => {
              const status = statusConfig[order.status] || statusConfig.pending;
              const delivery = deliveries[order.orderId];
              const delStatus = delivery ? deliveryStatusLabels[delivery.status] : null;

              return (
                <div key={order.orderId} className="border border-border rounded-sm p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-display text-sm font-medium text-foreground">{order.orderId}</p>
                      <p className="font-body text-xs text-muted-foreground">
                        {new Date(order.createdAt).toLocaleDateString("en-US", {
                          year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-sm text-xs font-body ${status.color}`}>
                      {status.icon}
                      {status.label}
                    </span>
                  </div>

                  <div className="space-y-1">
                    {order.items.map((item, i) => (
                      <div key={i} className="flex justify-between font-body text-sm text-muted-foreground">
                        <span>{item.name} ({item.size}) x{item.quantity}</span>
                        <span>LKR {(item.unitPrice * item.quantity).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>

                  {/* Delivery Status */}
                  {delivery && delStatus && (
                    <>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Truck size={16} className={delStatus.color} />
                          <span className={`font-body text-sm font-medium ${delStatus.color}`}>
                            {delStatus.label}
                          </span>
                          <span className="font-body text-xs text-muted-foreground">
                            · {delivery.deliveryMethod}
                          </span>
                        </div>
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="rounded-sm font-body text-xs"
                        >
                          <Link to={`/delivery/${delivery.deliveryId}`}>
                            <Truck size={12} className="mr-1" />
                            Track Delivery
                          </Link>
                        </Button>
                      </div>
                      {delivery.scheduledDate && (
                        <p className="font-body text-xs text-muted-foreground">
                          Scheduled: {new Date(delivery.scheduledDate).toLocaleDateString()} - {delivery.scheduledTimeSlot}
                        </p>
                      )}
                      {delivery.deliveredAt && (
                        <p className="font-body text-xs text-green-600">
                          Delivered on {new Date(delivery.deliveredAt).toLocaleString()}
                        </p>
                      )}
                    </>
                  )}

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="font-body text-sm">
                      <span className="text-muted-foreground">Total: </span>
                      <span className="text-foreground font-medium">LKR {order.total.toLocaleString()}</span>
                      {order.discount > 0 && (
                        <span className="text-green-600 text-xs ml-2">(saved LKR {order.discount.toLocaleString()})</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {order.status === "pending" && (
                        <>
                          <Button asChild size="sm" className="rounded-sm font-body text-xs bg-foreground text-background">
                            <Link to={`/payment/${order.orderId}`}>Pay Now</Link>
                          </Button>
                          <Button size="sm" variant="outline" className="rounded-sm font-body text-xs" onClick={() => handleCancel(order.orderId)}>
                            Cancel
                          </Button>
                        </>
                      )}
                      {order.status === "paid" && (
                        <Button asChild size="sm" variant="outline" className="rounded-sm font-body text-xs">
                          <Link to={`/payment-success/${order.orderId}`}>View Invoice</Link>
                        </Button>
                      )}
                    </div>
                  </div>

                  {order.loyaltyPointsEarned > 0 && order.status === "paid" && (
                    <p className="font-body text-xs text-muted-foreground">
                      +{order.loyaltyPointsEarned} loyalty points earned
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
