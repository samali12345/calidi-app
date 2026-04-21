import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";
import type { Order } from "@/lib/types";

const statusConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  pending: { icon: <Clock size={12} />, color: "text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400" },
  paid: { icon: <CheckCircle size={12} />, color: "text-green-600 bg-green-50 dark:bg-green-950/30 dark:text-green-400" },
  expired: { icon: <AlertCircle size={12} />, color: "text-gray-500 bg-gray-50 dark:bg-gray-900/30 dark:text-gray-400" },
  cancelled: { icon: <XCircle size={12} />, color: "text-red-600 bg-red-50 dark:bg-red-950/30 dark:text-red-400" },
};

const statusFilters = ["all", "pending", "paid", "expired", "cancelled"];

export default function OrdersPage() {
  const { token } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const fetchOrders = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const statusParam = filter !== "all" ? `&status=${filter}` : "";
      const data = await apiFetch<{ orders: Order[]; total: number }>(`/admin/orders?page=${page}${statusParam}`, { token });
      setOrders(data.orders);
      setTotal(data.total);
    } catch {
      toast.error("Failed to load orders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchOrders(); }, [token, page, filter]);

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    if (!token) return;
    try {
      await apiFetch(`/admin/orders/${orderId}/status`, {
        method: "PUT",
        token,
        body: { status: newStatus },
      });
      toast.success(`Order ${newStatus}`);
      fetchOrders();
    } catch (err: any) {
      toast.error(err.message || "Failed to update");
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-wider text-foreground">Orders</h1>

      {/* Status Filters */}
      <div className="flex gap-2">
        {statusFilters.map((s) => (
          <button
            key={s}
            onClick={() => { setFilter(s); setPage(1); }}
            className={`font-body text-xs uppercase tracking-wider px-3 py-1.5 rounded-sm transition-colors ${
              filter === s ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <p className="font-body text-sm text-muted-foreground">{total} orders</p>

      {loading ? (
        <p className="font-body text-muted-foreground py-8 text-center">Loading...</p>
      ) : orders.length === 0 ? (
        <p className="font-body text-muted-foreground py-8 text-center">No orders found</p>
      ) : (
        <div className="border border-border rounded-sm overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left font-body text-xs uppercase tracking-wider text-muted-foreground p-3">Order ID</th>
                <th className="text-left font-body text-xs uppercase tracking-wider text-muted-foreground p-3">Customer</th>
                <th className="text-right font-body text-xs uppercase tracking-wider text-muted-foreground p-3">Items</th>
                <th className="text-right font-body text-xs uppercase tracking-wider text-muted-foreground p-3">Total</th>
                <th className="text-center font-body text-xs uppercase tracking-wider text-muted-foreground p-3">Status</th>
                <th className="text-left font-body text-xs uppercase tracking-wider text-muted-foreground p-3">Date</th>
                <th className="text-right font-body text-xs uppercase tracking-wider text-muted-foreground p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => {
                const sc = statusConfig[order.status] || statusConfig.pending;
                return (
                  <tr key={order.orderId} className="border-b border-border last:border-0 hover:bg-secondary/10">
                    <td className="p-3 font-body text-sm text-foreground">{order.orderId}</td>
                    <td className="p-3 font-body text-sm text-muted-foreground">{order.userEmail}</td>
                    <td className="p-3 font-body text-sm text-foreground text-right">{order.items.reduce((s, i) => s + i.quantity, 0)}</td>
                    <td className="p-3 font-body text-sm text-foreground text-right">LKR {order.total.toLocaleString()}</td>
                    <td className="p-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-sm text-xs font-body ${sc.color}`}>
                        {sc.icon} {order.status}
                      </span>
                    </td>
                    <td className="p-3 font-body text-xs text-muted-foreground">
                      {new Date(order.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-right">
                      {order.status === "pending" && (
                        <div className="flex gap-1 justify-end">
                          <Button size="sm" className="h-6 text-xs rounded-sm" onClick={() => handleStatusUpdate(order.orderId, "paid")}>Mark Paid</Button>
                          <Button size="sm" variant="outline" className="h-6 text-xs rounded-sm" onClick={() => handleStatusUpdate(order.orderId, "cancelled")}>Cancel</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-sm font-body text-xs">Previous</Button>
        <span className="font-body text-sm text-muted-foreground self-center">Page {page}</span>
        <Button variant="outline" size="sm" disabled={orders.length < 20} onClick={() => setPage(page + 1)} className="rounded-sm font-body text-xs">Next</Button>
      </div>
    </div>
  );
}
