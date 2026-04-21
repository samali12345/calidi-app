import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000/api";

export default function AddProductDialog({ open, onClose, onCreated }: Props) {
  const { token } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "", description: "", brand: "", colour: "", price: "",
    category: "Western", stock: "50", lowStockThreshold: "10",
  });
  const [image, setImage] = useState<File | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSubmitting(true);

    try {
      const formData = new FormData();
      Object.entries(form).forEach(([k, v]) => formData.append(k, v));
      if (image) formData.append("image", image);

      const res = await fetch(`${API_BASE}/admin/products`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create product");
      }

      toast.success("Product created successfully");
      setForm({ name: "", description: "", brand: "", colour: "", price: "", category: "Western", stock: "50", lowStockThreshold: "10" });
      setImage(null);
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-background border border-border rounded-sm w-full max-w-lg p-6 space-y-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="font-display text-xl tracking-wider text-foreground">Add New Product</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="font-body text-xs uppercase tracking-widest text-muted-foreground">Name *</Label>
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="rounded-sm font-body" />
          </div>

          <div className="space-y-2">
            <Label className="font-body text-xs uppercase tracking-widest text-muted-foreground">Description</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="rounded-sm font-body" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-body text-xs uppercase tracking-widest text-muted-foreground">Brand</Label>
              <Input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} className="rounded-sm font-body" />
            </div>
            <div className="space-y-2">
              <Label className="font-body text-xs uppercase tracking-widest text-muted-foreground">Colour</Label>
              <Input value={form.colour} onChange={(e) => setForm({ ...form, colour: e.target.value })} className="rounded-sm font-body" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-body text-xs uppercase tracking-widest text-muted-foreground">Price (LKR) *</Label>
              <Input required type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} className="rounded-sm font-body" />
            </div>
            <div className="space-y-2">
              <Label className="font-body text-xs uppercase tracking-widest text-muted-foreground">Category</Label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full h-10 px-3 rounded-sm border border-input bg-background font-body text-sm"
              >
                <option value="Western">Western</option>
                <option value="Ethnic">Ethnic</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="font-body text-xs uppercase tracking-widest text-muted-foreground">Stock</Label>
              <Input type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} className="rounded-sm font-body" />
            </div>
            <div className="space-y-2">
              <Label className="font-body text-xs uppercase tracking-widest text-muted-foreground">Low Stock Threshold</Label>
              <Input type="number" min="0" value={form.lowStockThreshold} onChange={(e) => setForm({ ...form, lowStockThreshold: e.target.value })} className="rounded-sm font-body" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-body text-xs uppercase tracking-widest text-muted-foreground">Product Image</Label>
            <Input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] || null)} className="rounded-sm font-body" />
          </div>

          <div className="flex gap-3 pt-2">
            <Button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-foreground text-background hover:bg-foreground/90 font-body uppercase tracking-widest text-sm rounded-sm"
            >
              {submitting ? "Creating..." : "Create Product"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} className="font-body uppercase tracking-widest text-sm rounded-sm">
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
