import { useEffect, useState } from "react";
import axios from "axios";
import ProductCard from "./ProductCard";
import type { Product } from "@/lib/types";
import { useCart } from "@/context/CartContext";
import { toast } from "sonner";

type OutfitItem = {
  role: string;
  category?: string;
  product: Product;
};

type OutfitBuilderProps = {
  sourceProduct: Product;
};

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000/api";

export default function OutfitBuilder({ sourceProduct }: OutfitBuilderProps) {
  const { addItem } = useCart();
  const [items, setItems] = useState<OutfitItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchOutfit = async () => {
      if (!sourceProduct?.p_id) {
        setItems([]);
        return;
      }
      try {
        setLoading(true);
        const res = await axios.get(
          `${API_BASE}/products/outfit/${encodeURIComponent(String(sourceProduct.p_id))}`,
          { params: { top_n: 4, engine: "api" } }
        );
        const normalized = (Array.isArray(res.data) ? res.data : [])
          .map((entry: any) => {
            const p = entry?.product || {};
            return {
              role: String(entry?.role || "Pair with"),
              category: String(entry?.category || p?.category || ""),
              product: {
                ...p,
                id: p.id || String(p._id || p.p_id),
                p_id: Number(p.p_id),
                price: Number(p.price || 0),
                sizes: p.sizes || ["S", "M", "L", "XL", "XXL"],
                stock: p.stock ?? 50,
              } as Product,
            } as OutfitItem;
          })
          .filter((entry: OutfitItem) => Number.isFinite(entry.product.p_id));
        setItems(normalized);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchOutfit();
  }, [sourceProduct.p_id]);

  if (loading) {
    return (
      <section className="pt-10 mt-10 border-t border-border">
        <h2 className="font-display text-2xl uppercase tracking-widest mb-6">Style It With</h2>
        <p className="font-body text-sm text-muted-foreground">Building outfit suggestions...</p>
      </section>
    );
  }

  if (items.length < 2) return null;

  const handleAddAll = () => {
    let added = 0;
    for (const entry of items) {
      const product = entry.product;
      if ((product.stock ?? 0) <= 0) continue;
      const defaultSize = product.sizes?.[0] || "M";
      addItem(product, defaultSize);
      added += 1;
    }
    if (added > 0) {
      toast.success(`Added ${added} outfit item${added > 1 ? "s" : ""} to bag`);
    } else {
      toast.error("No available items to add");
    }
  };

  return (
    <section className="pt-10 mt-10 border-t border-border">
      <div className="flex items-center justify-between gap-4 mb-6">
        <h2 className="font-display text-2xl uppercase tracking-widest">Style It With</h2>
        <button
          type="button"
          onClick={handleAddAll}
          className="px-4 py-2 bg-foreground text-background font-body text-xs uppercase tracking-[0.2em] hover:bg-foreground/90 transition-colors"
        >
          Add All To Bag
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-1 border border-border rounded-sm p-3">
          <p className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
            Your Pick
          </p>
          <img
            src={sourceProduct.image}
            alt={sourceProduct.name}
            className="w-full aspect-[3/4] object-cover bg-secondary"
          />
          <p className="font-display text-sm mt-3 line-clamp-2">{sourceProduct.name}</p>
          <p className="font-body text-sm text-muted-foreground">
            LKR {sourceProduct.price.toLocaleString()}
          </p>
        </div>

        <div className="lg:col-span-4">
          <div className="flex gap-5 overflow-x-auto pb-2">
            {items.map((entry) => (
              <div key={`${entry.product.p_id}-${entry.role}`} className="min-w-[240px] w-[240px]">
                <p className="font-body text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-2">
                  {entry.role}
                </p>
                <ProductCard product={entry.product} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
