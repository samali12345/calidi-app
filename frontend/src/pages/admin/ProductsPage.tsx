import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Plus, Search, AlertTriangle, RefreshCw, Trash2 } from "lucide-react";
import AddProductDialog from "./AddProductDialog";
import type { Product } from "@/lib/types";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000/api";

export default function ProductsPage() {
  const { token } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingStock, setEditingStock] = useState<{ pId: number; value: string } | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchProducts = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const data = await apiFetch<{ products: Product[]; total: number }>(`/admin/products?page=${page}&search=${search}`, { token });
      setProducts(data.products);
      setTotal(data.total);
    } catch {
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchProducts(); }, [token, page, search]);

  const handleStockUpdate = async (pId: number) => {
    if (!editingStock || !token) return;
    try {
      await apiFetch(`/admin/products/${pId}`, {
        method: "PUT",
        token,
        body: { stock: parseInt(editingStock.value) },
      });
      toast.success("Stock updated");
      setEditingStock(null);
      fetchProducts();
    } catch {
      toast.error("Failed to update stock");
    }
  };

  const handleDelete = async (pId: number, name: string) => {
    if (!token) return;
    if (!window.confirm(`Are you sure you want to delete "${name}"? This cannot be undone.`)) return;
    setDeletingId(pId);
    try {
      const res = await apiFetch<{ message: string }>(`/admin/products/${pId}`, {
        method: "DELETE",
        token,
      });
      toast.success(res.message);
      fetchProducts();
    } catch {
      toast.error("Failed to delete product");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold tracking-wider text-foreground">Products</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              if (!token) return;
              try {
                const res = await apiFetch<{ message: string }>("/admin/products/restock", {
                  method: "POST",
                  token,
                  body: { stock: 50 },
                });
                toast.success(res.message);
                fetchProducts();
              } catch {
                toast.error("Failed to restock");
              }
            }}
            className="font-body text-sm rounded-sm"
          >
            <RefreshCw size={16} className="mr-1" /> Restock All
          </Button>
          <Button onClick={() => setShowAdd(true)} className="bg-foreground text-background hover:bg-foreground/90 font-body text-sm rounded-sm">
            <Plus size={16} className="mr-1" /> Add Product
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search products..."
          className="pl-9 rounded-sm font-body"
        />
      </div>

      <p className="font-body text-sm text-muted-foreground">{total} products found</p>

      {loading ? (
        <p className="font-body text-muted-foreground py-8 text-center">Loading...</p>
      ) : (
        <div className="border border-border rounded-sm overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="text-left font-body text-xs uppercase tracking-wider text-muted-foreground p-3">Product</th>
                <th className="text-left font-body text-xs uppercase tracking-wider text-muted-foreground p-3">Brand</th>
                <th className="text-left font-body text-xs uppercase tracking-wider text-muted-foreground p-3">Category</th>
                <th className="text-right font-body text-xs uppercase tracking-wider text-muted-foreground p-3">Price</th>
                <th className="text-right font-body text-xs uppercase tracking-wider text-muted-foreground p-3">Stock</th>
                <th className="text-right font-body text-xs uppercase tracking-wider text-muted-foreground p-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product: any) => {
                const isLow = (product.stock ?? 50) <= (product.lowStockThreshold ?? 10);
                const gridFsImageUrl = `${API_BASE}/products/image/${product.p_id}`;
                const fallbackImageUrl = product.img || product.image || "";
                return (
                  <tr key={product.p_id} className="border-b border-border last:border-0 hover:bg-secondary/10">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={gridFsImageUrl}
                          alt={product.name}
                          className="w-10 h-12 object-cover rounded-sm bg-secondary"
                          onError={(e) => {
                            if (!fallbackImageUrl) return;
                            const img = e.currentTarget;
                            if (img.src !== fallbackImageUrl) {
                              img.src = fallbackImageUrl;
                            }
                          }}
                        />
                        <span className="font-body text-sm text-foreground">{product.name}</span>
                      </div>
                    </td>
                    <td className="p-3 font-body text-sm text-muted-foreground">{product.brand}</td>
                    <td className="p-3 font-body text-sm text-muted-foreground">{product.category}</td>
                    <td className="p-3 font-body text-sm text-foreground text-right">LKR {product.price?.toLocaleString()}</td>
                    <td className="p-3 text-right">
                      {editingStock?.pId === product.p_id ? (
                        <div className="flex items-center justify-end gap-1">
                          <Input
                            type="number"
                            value={editingStock.value}
                            onChange={(e) => setEditingStock({ pId: product.p_id, value: e.target.value })}
                            className="w-20 h-7 text-sm rounded-sm"
                            onKeyDown={(e) => e.key === "Enter" && handleStockUpdate(product.p_id)}
                          />
                          <Button size="sm" className="h-7 text-xs rounded-sm" onClick={() => handleStockUpdate(product.p_id)}>Save</Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingStock({ pId: product.p_id, value: String(product.stock ?? 50) })}
                          className={`font-body text-sm inline-flex items-center gap-1 ${isLow ? "text-amber-600 font-medium" : "text-foreground"}`}
                        >
                          {isLow && <AlertTriangle size={12} />}
                          {product.stock ?? 50}
                        </button>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={deletingId === product.p_id}
                        onClick={() => handleDelete(product.p_id, product.name)}
                        className="h-7 text-xs rounded-sm text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 size={12} className="mr-1" />
                        {deletingId === product.p_id ? "Deleting..." : "Remove"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className="flex justify-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-sm font-body text-xs">Previous</Button>
        <span className="font-body text-sm text-muted-foreground self-center">Page {page}</span>
        <Button variant="outline" size="sm" disabled={products.length < 50} onClick={() => setPage(page + 1)} className="rounded-sm font-body text-xs">Next</Button>
      </div>

      <AddProductDialog open={showAdd} onClose={() => setShowAdd(false)} onCreated={fetchProducts} />
    </div>
  );
}
