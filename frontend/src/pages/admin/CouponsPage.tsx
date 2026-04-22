import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { Coupon } from "@/lib/types";

export default function CouponsPage() {
  const { token } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    code: "",
    discountType: "percentage" as "percentage" | "fixed",
    discountValue: "",
    minOrderValue: "0",
    maxUses: "",
    expiresAt: "",
    isActive: true,
  });

  const fetchCoupons = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch<Coupon[]>("/admin/coupons", { token });
      setCoupons(data);
    } catch {
      toast.error("Failed to load coupons");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoupons();
  }, [token]);

  const createCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);
    try {
      await apiFetch("/admin/coupons", {
        method: "POST",
        token,
        body: {
          code: form.code,
          discountType: form.discountType,
          discountValue: Number(form.discountValue),
          minOrderValue: Number(form.minOrderValue || 0),
          maxUses: form.maxUses === "" ? null : Number(form.maxUses),
          expiresAt: form.expiresAt || null,
          isActive: form.isActive,
        },
      });
      toast.success("Coupon created");
      setForm({
        code: "",
        discountType: "percentage",
        discountValue: "",
        minOrderValue: "0",
        maxUses: "",
        expiresAt: "",
        isActive: true,
      });
      fetchCoupons();
    } catch (err: any) {
      toast.error(err.message || "Failed to create coupon");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleCoupon = async (coupon: Coupon) => {
    if (!token) return;
    try {
      await apiFetch(`/admin/coupons/${coupon._id}`, {
        method: "PUT",
        token,
        body: { isActive: !coupon.isActive },
      });
      toast.success(`Coupon ${!coupon.isActive ? "activated" : "deactivated"}`);
      fetchCoupons();
    } catch {
      toast.error("Failed to update coupon");
    }
  };

  const deleteCoupon = async (coupon: Coupon) => {
    if (!token) return;
    if (!window.confirm(`Delete coupon "${coupon.code}"?`)) return;
    try {
      await apiFetch(`/admin/coupons/${coupon._id}`, {
        method: "DELETE",
        token,
      });
      toast.success("Coupon deleted");
      fetchCoupons();
    } catch {
      toast.error("Failed to delete coupon");
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="font-display text-2xl font-bold tracking-wider text-foreground">Coupons</h1>

      <form onSubmit={createCoupon} className="border border-border rounded-sm p-4 space-y-4">
        <h2 className="font-display text-lg tracking-wider text-foreground">Create Coupon</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label className="font-body text-xs uppercase tracking-widest text-muted-foreground">Code</Label>
            <Input
              required
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder="CALIDI10"
              className="rounded-sm font-body"
            />
          </div>
          <div className="space-y-2">
            <Label className="font-body text-xs uppercase tracking-widest text-muted-foreground">Type</Label>
            <select
              value={form.discountType}
              onChange={(e) => setForm((f) => ({ ...f, discountType: e.target.value as "percentage" | "fixed" }))}
              className="w-full h-10 rounded-sm border border-input bg-background px-3 text-sm font-body"
            >
              <option value="percentage">percentage</option>
              <option value="fixed">fixed</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label className="font-body text-xs uppercase tracking-widest text-muted-foreground">Value</Label>
            <Input
              required
              type="number"
              min={1}
              value={form.discountValue}
              onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
              className="rounded-sm font-body"
            />
          </div>
          <div className="space-y-2">
            <Label className="font-body text-xs uppercase tracking-widest text-muted-foreground">Min Order (LKR)</Label>
            <Input
              type="number"
              min={0}
              value={form.minOrderValue}
              onChange={(e) => setForm((f) => ({ ...f, minOrderValue: e.target.value }))}
              className="rounded-sm font-body"
            />
          </div>
          <div className="space-y-2">
            <Label className="font-body text-xs uppercase tracking-widest text-muted-foreground">Max Uses (blank=unlimited)</Label>
            <Input
              type="number"
              min={1}
              value={form.maxUses}
              onChange={(e) => setForm((f) => ({ ...f, maxUses: e.target.value }))}
              className="rounded-sm font-body"
            />
          </div>
          <div className="space-y-2">
            <Label className="font-body text-xs uppercase tracking-widest text-muted-foreground">Expires At</Label>
            <Input
              type="date"
              value={form.expiresAt}
              onChange={(e) => setForm((f) => ({ ...f, expiresAt: e.target.value }))}
              className="rounded-sm font-body"
            />
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
            className="rounded border-border"
          />
          <span className="font-body text-sm text-foreground">Active</span>
        </label>
        <Button
          type="submit"
          disabled={submitting}
          className="bg-foreground text-background hover:bg-foreground/90 font-body text-sm rounded-sm"
        >
          {submitting ? "Creating..." : "Create Coupon"}
        </Button>
      </form>

      <div className="border border-border rounded-sm overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-secondary/30">
              <th className="text-left font-body text-xs uppercase tracking-wider text-muted-foreground p-3">Code</th>
              <th className="text-left font-body text-xs uppercase tracking-wider text-muted-foreground p-3">Discount</th>
              <th className="text-right font-body text-xs uppercase tracking-wider text-muted-foreground p-3">Min Order</th>
              <th className="text-right font-body text-xs uppercase tracking-wider text-muted-foreground p-3">Uses</th>
              <th className="text-left font-body text-xs uppercase tracking-wider text-muted-foreground p-3">Expiry</th>
              <th className="text-left font-body text-xs uppercase tracking-wider text-muted-foreground p-3">Status</th>
              <th className="text-right font-body text-xs uppercase tracking-wider text-muted-foreground p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="p-4 font-body text-sm text-muted-foreground" colSpan={7}>Loading...</td>
              </tr>
            ) : coupons.length === 0 ? (
              <tr>
                <td className="p-4 font-body text-sm text-muted-foreground" colSpan={7}>No coupons yet.</td>
              </tr>
            ) : (
              coupons.map((coupon) => (
                <tr key={coupon._id} className="border-b border-border last:border-0">
                  <td className="p-3 font-body text-sm text-foreground">{coupon.code}</td>
                  <td className="p-3 font-body text-sm text-muted-foreground">
                    {coupon.discountType === "percentage"
                      ? `${coupon.discountValue}%`
                      : `LKR ${coupon.discountValue.toLocaleString()}`}
                  </td>
                  <td className="p-3 font-body text-sm text-foreground text-right">LKR {coupon.minOrderValue.toLocaleString()}</td>
                  <td className="p-3 font-body text-sm text-foreground text-right">
                    {coupon.usedCount}/{coupon.maxUses ?? "∞"}
                  </td>
                  <td className="p-3 font-body text-sm text-muted-foreground">
                    {coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleDateString() : "No expiry"}
                  </td>
                  <td className="p-3">
                    <span className={`px-2 py-1 rounded-sm text-xs font-body ${coupon.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {coupon.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleCoupon(coupon)}
                        className="h-7 text-xs rounded-sm"
                      >
                        {coupon.isActive ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteCoupon(coupon)}
                        className="h-7 text-xs rounded-sm text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
