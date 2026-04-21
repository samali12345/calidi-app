import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { toast } from "sonner";
import LoyaltyBadge from "@/components/LoyaltyBadge";

interface Customer {
  _id: string;
  email: string;
  role: string;
  loyaltyTier: string;
  loyaltyPoints: number;
  totalOrders: number;
  createdAt: string;
}

export default function CustomersPage() {
  const { token } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    apiFetch<Customer[]>("/admin/customers", { token })
      .then(setCustomers)
      .catch(() => toast.error("Failed to load customers"))
      .finally(() => setLoading(false));
  }, [token]);

  const loyalCount = customers.filter((c) => c.loyaltyTier !== "none").length;
  const goldCount = customers.filter((c) => c.loyaltyTier === "gold").length;
  const silverCount = customers.filter((c) => c.loyaltyTier === "silver").length;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold tracking-wider text-foreground">Customers</h1>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-secondary/30 border border-border rounded-sm p-4 text-center">
          <p className="font-display text-2xl text-foreground">{customers.length}</p>
          <p className="font-body text-xs text-muted-foreground uppercase tracking-wider">Total</p>
        </div>
        <div className="bg-secondary/30 border border-border rounded-sm p-4 text-center">
          <p className="font-display text-2xl text-foreground">{loyalCount}</p>
          <p className="font-body text-xs text-muted-foreground uppercase tracking-wider">Loyal</p>
        </div>
        <div className="bg-secondary/30 border border-border rounded-sm p-4 text-center">
          <p className="font-display text-2xl text-gray-500">{silverCount}</p>
          <p className="font-body text-xs text-muted-foreground uppercase tracking-wider">Silver</p>
        </div>
        <div className="bg-secondary/30 border border-border rounded-sm p-4 text-center">
          <p className="font-display text-2xl text-amber-500">{goldCount}</p>
          <p className="font-body text-xs text-muted-foreground uppercase tracking-wider">Gold</p>
        </div>
      </div>

      {loading ? (
        <p className="font-body text-muted-foreground py-8 text-center">Loading...</p>
      ) : (
        <div className="border border-border rounded-sm overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left font-body text-xs uppercase tracking-wider text-muted-foreground p-3">Email</th>
                <th className="text-center font-body text-xs uppercase tracking-wider text-muted-foreground p-3">Tier</th>
                <th className="text-right font-body text-xs uppercase tracking-wider text-muted-foreground p-3">Points</th>
                <th className="text-right font-body text-xs uppercase tracking-wider text-muted-foreground p-3">Orders</th>
                <th className="text-left font-body text-xs uppercase tracking-wider text-muted-foreground p-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((customer) => (
                <tr key={customer._id} className="border-b border-border last:border-0 hover:bg-secondary/10">
                  <td className="p-3 font-body text-sm text-foreground">{customer.email}</td>
                  <td className="p-3 text-center">
                    <LoyaltyBadge tier={customer.loyaltyTier} size="sm" />
                  </td>
                  <td className="p-3 font-body text-sm text-foreground text-right">{customer.loyaltyPoints}</td>
                  <td className="p-3 font-body text-sm text-foreground text-right">{customer.totalOrders}</td>
                  <td className="p-3 font-body text-xs text-muted-foreground">
                    {new Date(customer.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
