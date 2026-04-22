import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Download } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const COLORS = ["#8b5cf6", "#f59e0b", "#ef4444", "#10b981", "#3b82f6", "#ec4899"];

export default function ReportsPage() {
  const { token } = useAuth();
  const [tab, setTab] = useState<"sales" | "stock" | "stripe">("sales");

  // Sales state
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [salesReport, setSalesReport] = useState<any>(null);

  // Stock state
  const [stockReport, setStockReport] = useState<any>(null);
  const [stripeOverview, setStripeOverview] = useState<{
    balance: {
      lkrAvailable: number;
      lkrPending: number;
      usdToLkrRate: number;
      availableBreakdown: Array<{ currency: string; amountMajor: number; lkrEquivalent: number }>;
      pendingBreakdown: Array<{ currency: string; amountMajor: number; lkrEquivalent: number }>;
    };
    recentPayments: Array<{
      id: string;
      amountMajor: number;
      lkrAmount: number;
      currency: string;
      status: string;
      createdAt: string | null;
      orderId: string | null;
    }>;
  } | null>(null);

  const fetchSalesReport = async () => {
    if (!token) return;
    try {
      const data = await apiFetch(`/admin/reports/sales?start=${startDate}&end=${endDate}`, { token });
      setSalesReport(data);
    } catch {
      toast.error("Failed to load sales report");
    }
  };

  const fetchStockReport = async () => {
    if (!token) return;
    try {
      const data = await apiFetch(`/admin/reports/stock`, { token });
      setStockReport(data);
    } catch {
      toast.error("Failed to load stock report");
    }
  };

  const fetchStripeOverview = async () => {
    if (!token) return;
    try {
      const data = await apiFetch("/admin/stripe/overview", { token });
      setStripeOverview(data);
    } catch {
      toast.error("Failed to load Stripe overview");
    }
  };

  useEffect(() => {
    if (tab === "sales") fetchSalesReport();
    else if (tab === "stock") fetchStockReport();
    else fetchStripeOverview();
  }, [token, tab]);

  const exportCSV = () => {
    if (!stockReport?.products) return;
    const header = "P_ID,Name,Brand,Category,Stock,Threshold\n";
    const rows = stockReport.products.map((p: any) =>
      `${p.p_id},"${p.name}","${p.brand}","${p.category}",${p.stock},${p.lowStockThreshold}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "stock_report.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-wider text-foreground">Reports</h1>

      {/* Tab Nav */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab("sales")}
          className={`font-body text-xs uppercase tracking-wider px-3 py-1.5 rounded-sm ${tab === "sales" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary"}`}
        >
          Sales
        </button>
        <button
          onClick={() => setTab("stock")}
          className={`font-body text-xs uppercase tracking-wider px-3 py-1.5 rounded-sm ${tab === "stock" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary"}`}
        >
          Stock
        </button>
        <button
          onClick={() => setTab("stripe")}
          className={`font-body text-xs uppercase tracking-wider px-3 py-1.5 rounded-sm ${tab === "stripe" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-secondary"}`}
        >
          Stripe
        </button>
      </div>

      {tab === "sales" && (
        <div className="space-y-6">
          {/* Date Range */}
          <div className="flex gap-4 items-end">
            <div className="space-y-1">
              <Label className="font-body text-xs uppercase tracking-widest text-muted-foreground">From</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="rounded-sm font-body w-40" />
            </div>
            <div className="space-y-1">
              <Label className="font-body text-xs uppercase tracking-widest text-muted-foreground">To</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="rounded-sm font-body w-40" />
            </div>
            <Button onClick={fetchSalesReport} className="bg-foreground text-background hover:bg-foreground/90 font-body text-sm rounded-sm">
              Generate
            </Button>
          </div>

          {salesReport && (
            <>
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-secondary/30 border border-border rounded-sm p-4 text-center">
                  <p className="font-display text-xl text-foreground">LKR {salesReport.summary.totalRevenue?.toLocaleString() || 0}</p>
                  <p className="font-body text-xs text-muted-foreground uppercase tracking-wider">Revenue</p>
                </div>
                <div className="bg-secondary/30 border border-border rounded-sm p-4 text-center">
                  <p className="font-display text-xl text-foreground">{salesReport.summary.totalOrders || 0}</p>
                  <p className="font-body text-xs text-muted-foreground uppercase tracking-wider">Orders</p>
                </div>
                <div className="bg-secondary/30 border border-border rounded-sm p-4 text-center">
                  <p className="font-display text-xl text-foreground">LKR {Math.round(salesReport.summary.avgOrderValue || 0).toLocaleString()}</p>
                  <p className="font-body text-xs text-muted-foreground uppercase tracking-wider">Avg Order</p>
                </div>
              </div>

              {/* Category Chart */}
              {salesReport.categoryBreakdown.length > 0 && (
                <div className="bg-secondary/30 border border-border rounded-sm p-5">
                  <h3 className="font-display text-lg tracking-wider text-foreground mb-4">Revenue by Category</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={salesReport.categoryBreakdown}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="category" className="font-body text-xs" />
                      <YAxis className="font-body text-xs" />
                      <Tooltip formatter={(value: number) => [`LKR ${value.toLocaleString()}`, "Revenue"]} />
                      <Bar dataKey="revenue" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === "stock" && (
        <div className="space-y-6">
          {stockReport && (
            <>
              {/* Stock Distribution Pie */}
              {stockReport.distribution.length > 0 && (
                <div className="bg-secondary/30 border border-border rounded-sm p-5">
                  <h3 className="font-display text-lg tracking-wider text-foreground mb-4">Stock Distribution</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie data={stockReport.distribution} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={100} label>
                        {stockReport.distribution.map((_: any, i: number) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Stock Table */}
              <div className="flex justify-between items-center">
                <h3 className="font-display text-lg tracking-wider text-foreground">All Products by Stock</h3>
                <Button variant="outline" size="sm" onClick={exportCSV} className="rounded-sm font-body text-xs">
                  <Download size={14} className="mr-1" /> Export CSV
                </Button>
              </div>
              <div className="border border-border rounded-sm overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-secondary">
                    <tr className="border-b border-border">
                      <th className="text-left font-body text-xs uppercase tracking-wider text-muted-foreground p-3">Product</th>
                      <th className="text-left font-body text-xs uppercase tracking-wider text-muted-foreground p-3">Category</th>
                      <th className="text-right font-body text-xs uppercase tracking-wider text-muted-foreground p-3">Stock</th>
                      <th className="text-right font-body text-xs uppercase tracking-wider text-muted-foreground p-3">Threshold</th>
                      <th className="text-center font-body text-xs uppercase tracking-wider text-muted-foreground p-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stockReport.products.map((p: any) => {
                      const status = p.stock === 0 ? "Out of Stock" : p.stock <= p.lowStockThreshold ? "Low Stock" : "In Stock";
                      const statusColor = p.stock === 0 ? "text-red-600 bg-red-50" : p.stock <= p.lowStockThreshold ? "text-amber-600 bg-amber-50" : "text-green-600 bg-green-50";
                      return (
                        <tr key={p.p_id} className="border-b border-border last:border-0">
                          <td className="p-3 font-body text-sm text-foreground">{p.name}</td>
                          <td className="p-3 font-body text-sm text-muted-foreground">{p.category}</td>
                          <td className="p-3 font-body text-sm text-foreground text-right">{p.stock}</td>
                          <td className="p-3 font-body text-sm text-muted-foreground text-right">{p.lowStockThreshold}</td>
                          <td className="p-3 text-center">
                            <span className={`text-xs px-2 py-0.5 rounded-sm ${statusColor}`}>{status}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {tab === "stripe" && (
        <div className="space-y-6">
          {stripeOverview && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-secondary/30 border border-border rounded-sm p-4 text-center">
                  <p className="font-display text-xl text-foreground">
                    LKR {stripeOverview.balance.lkrAvailable.toLocaleString()}
                  </p>
                  <p className="font-body text-xs text-muted-foreground uppercase tracking-wider">
                    Stripe Available Balance
                  </p>
                </div>
                <div className="bg-secondary/30 border border-border rounded-sm p-4 text-center">
                  <p className="font-display text-xl text-foreground">
                    LKR {stripeOverview.balance.lkrPending.toLocaleString()}
                  </p>
                  <p className="font-body text-xs text-muted-foreground uppercase tracking-wider">
                    Stripe Pending Balance
                  </p>
                </div>
              </div>

              <p className="font-body text-xs text-muted-foreground">
                USD values are converted using 1 USD = LKR {stripeOverview.balance.usdToLkrRate}
              </p>

              <div className="border border-border rounded-sm overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-secondary border-b border-border">
                    <tr>
                      <th className="text-left font-body text-xs uppercase tracking-wider text-muted-foreground p-3">Payment Intent</th>
                      <th className="text-left font-body text-xs uppercase tracking-wider text-muted-foreground p-3">Order</th>
                      <th className="text-right font-body text-xs uppercase tracking-wider text-muted-foreground p-3">Amount</th>
                      <th className="text-right font-body text-xs uppercase tracking-wider text-muted-foreground p-3">LKR Eqv</th>
                      <th className="text-left font-body text-xs uppercase tracking-wider text-muted-foreground p-3">Status</th>
                      <th className="text-left font-body text-xs uppercase tracking-wider text-muted-foreground p-3">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stripeOverview.recentPayments.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-4 text-center font-body text-sm text-muted-foreground">
                          No Stripe payments yet
                        </td>
                      </tr>
                    )}
                    {stripeOverview.recentPayments.map((payment) => (
                      <tr key={payment.id} className="border-b border-border last:border-0">
                        <td className="p-3 font-body text-xs text-foreground">{payment.id}</td>
                        <td className="p-3 font-body text-sm text-muted-foreground">
                          {payment.orderId || "-"}
                        </td>
                        <td className="p-3 font-body text-sm text-foreground text-right">
                          {payment.currency} {payment.amountMajor.toLocaleString()}
                        </td>
                        <td className="p-3 font-body text-sm text-foreground text-right">
                          LKR {payment.lkrAmount.toLocaleString()}
                        </td>
                        <td className="p-3 font-body text-sm text-foreground">{payment.status}</td>
                        <td className="p-3 font-body text-sm text-muted-foreground">
                          {payment.createdAt ? new Date(payment.createdAt).toLocaleString() : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
