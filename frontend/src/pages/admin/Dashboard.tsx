import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { Link } from "react-router-dom";
import { DollarSign, ShoppingCart, Package, AlertTriangle } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { DashboardStats, SalesDataPoint, Order } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Dashboard() {
  const { token } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [salesData, setSalesData] = useState<SalesDataPoint[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [doublePointsActive, setDoublePointsActive] = useState(false);
  const [doublePointsEndsAt, setDoublePointsEndsAt] = useState("");
  const [savingDoublePoints, setSavingDoublePoints] = useState(false);

  useEffect(() => {
    if (!token) return;

    apiFetch<DashboardStats>("/admin/dashboard/stats", { token }).then(setStats).catch(() => {});
    apiFetch<SalesDataPoint[]>("/admin/dashboard/sales?period=30", { token }).then(setSalesData).catch(() => {});
    apiFetch<{ orders: Order[] }>("/admin/orders?limit=10", { token }).then((d) => setRecentOrders(d.orders)).catch(() => {});
    apiFetch<any[]>("/admin/products/low-stock", { token }).then(setLowStock).catch(() => {});
    apiFetch<{ active: boolean; endsAt?: string }>("/admin/settings/double-points", { token })
      .then((status) => {
        setDoublePointsActive(!!status.active);
        if (status.endsAt) {
          const local = new Date(status.endsAt);
          local.setMinutes(local.getMinutes() - local.getTimezoneOffset());
          setDoublePointsEndsAt(local.toISOString().slice(0, 16));
        }
      })
      .catch(() => {});
  }, [token]);

  const saveDoublePoints = async (enabled: boolean) => {
    if (!token) return;
    if (enabled && !doublePointsEndsAt) {
      toast.error("Please select an end date/time");
      return;
    }
    setSavingDoublePoints(true);
    try {
      const endsAtIso = doublePointsEndsAt ? new Date(doublePointsEndsAt).toISOString() : null;
      const data = await apiFetch<{ active: boolean; endsAt?: string }>("/admin/settings/double-points", {
        method: "PUT",
        token,
        body: { enabled, endsAt: endsAtIso },
      });
      setDoublePointsActive(!!data.active);
      toast.success(enabled ? "Double points enabled" : "Double points disabled");
    } catch (err: any) {
      toast.error(err.message || "Failed to update double points");
    } finally {
      setSavingDoublePoints(false);
    }
  };

  const statCards = [
    { label: "Total Revenue", value: stats ? `LKR ${stats.totalRevenue.toLocaleString()}` : "...", icon: DollarSign, color: "text-green-600" },
    { label: "Total Orders", value: stats?.totalOrders ?? "...", icon: ShoppingCart, color: "text-blue-600" },
    { label: "Total Products", value: stats?.totalProducts ?? "...", icon: Package, color: "text-purple-600" },
    { label: "Low Stock Alerts", value: stats?.lowStockCount ?? "...", icon: AlertTriangle, color: "text-amber-600" },
  ];

  const statusColors: Record<string, string> = {
    pending: "text-amber-600 bg-amber-50 dark:bg-amber-950/30",
    paid: "text-green-600 bg-green-50 dark:bg-green-950/30",
    expired: "text-gray-500 bg-gray-50 dark:bg-gray-900/30",
    cancelled: "text-red-600 bg-red-50 dark:bg-red-950/30",
  };

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl font-bold tracking-wider text-foreground">Dashboard</h1>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-secondary/30 border border-border rounded-sm p-5">
              <div className="flex items-center justify-between">
                <p className="font-body text-xs uppercase tracking-wider text-muted-foreground">{card.label}</p>
                <Icon size={18} className={card.color} />
              </div>
              <p className="font-display text-2xl text-foreground mt-2">{card.value}</p>
            </div>
          );
        })}
      </div>

      <div className="bg-secondary/30 border border-border rounded-sm p-5 space-y-4">
        <h2 className="font-display text-lg tracking-wider text-foreground">Double Points Event</h2>
        <p className="font-body text-sm text-muted-foreground">
          Status: {doublePointsActive ? "Active" : "Inactive"}
        </p>
        <div className="space-y-2 max-w-sm">
          <Label className="font-body text-xs uppercase tracking-widest text-muted-foreground">Ends At</Label>
          <Input
            type="datetime-local"
            value={doublePointsEndsAt}
            onChange={(e) => setDoublePointsEndsAt(e.target.value)}
            className="rounded-sm font-body"
          />
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => saveDoublePoints(true)}
            disabled={savingDoublePoints}
            className="rounded-sm font-body text-xs uppercase tracking-wider"
          >
            {savingDoublePoints ? "Saving..." : "Enable"}
          </Button>
          <Button
            variant="outline"
            onClick={() => saveDoublePoints(false)}
            disabled={savingDoublePoints}
            className="rounded-sm font-body text-xs uppercase tracking-wider"
          >
            Disable
          </Button>
        </div>
      </div>

      {/* Sales Chart */}
      <div className="bg-secondary/30 border border-border rounded-sm p-5">
        <h2 className="font-display text-lg tracking-wider text-foreground mb-4">Sales (Last 30 Days)</h2>
        {salesData.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={salesData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" className="font-body text-xs" tick={{ fontSize: 11 }} />
              <YAxis className="font-body text-xs" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ fontSize: 12, fontFamily: "inherit" }}
                formatter={(value: number) => [`LKR ${value.toLocaleString()}`, "Revenue"]}
              />
              <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" fill="#8b5cf680" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <p className="font-body text-sm text-muted-foreground py-12 text-center">No sales data yet</p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="bg-secondary/30 border border-border rounded-sm p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-display text-lg tracking-wider text-foreground">Recent Orders</h2>
            <Link to="/admin/orders" className="font-body text-xs text-primary hover:underline">View All</Link>
          </div>
          {recentOrders.length > 0 ? (
            <div className="space-y-3">
              {recentOrders.slice(0, 5).map((order) => (
                <div key={order.orderId} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="font-body text-sm text-foreground">{order.orderId}</p>
                    <p className="font-body text-xs text-muted-foreground">{order.userEmail}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-body text-sm text-foreground">LKR {order.total.toLocaleString()}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded-sm ${statusColors[order.status] || ""}`}>
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="font-body text-sm text-muted-foreground py-6 text-center">No orders yet</p>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-secondary/30 border border-border rounded-sm p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-display text-lg tracking-wider text-foreground">Low Stock Alerts</h2>
            <Link to="/admin/products" className="font-body text-xs text-primary hover:underline">Manage</Link>
          </div>
          {lowStock.length > 0 ? (
            <div className="space-y-3">
              {lowStock.slice(0, 8).map((product) => (
                <div key={product.p_id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="font-body text-sm text-foreground">{product.name}</p>
                    <p className="font-body text-xs text-muted-foreground">{product.brand}</p>
                  </div>
                  <span className={`font-body text-sm font-medium ${product.stock === 0 ? "text-red-600" : "text-amber-600"}`}>
                    {product.stock} left
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="font-body text-sm text-muted-foreground py-6 text-center">All products well stocked</p>
          )}
        </div>
      </div>
    </div>
  );
}
