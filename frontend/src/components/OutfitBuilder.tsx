import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import type { Product } from "@/lib/types";
import { useCart } from "@/context/CartContext";
import { toast } from "sonner";

type OutfitItem = {
  slot: string;
  subCategory?: string;
  concept?: string;
  product: Product;
};

type OutfitBuilderProps = {
  sourceProduct: Product;
};

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000/api";

export default function OutfitBuilder({ sourceProduct }: OutfitBuilderProps) {
  const { addItem } = useCart();
  const [items, setItems] = useState<OutfitItem[]>([]);
  const [outfitConcept, setOutfitConcept] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchOutfit = async () => {
      if (!sourceProduct?.p_id) {
        setItems([]);
        setOutfitConcept(null);
        return;
      }
      try {
        setLoading(true);
        const res = await axios.get(
          `${API_BASE}/products/outfit/${encodeURIComponent(String(sourceProduct.p_id))}`,
          { params: { top_n: 4 } }
        );
        const payload = res.data || {};
        setOutfitConcept(typeof payload.outfitConcept === "string" ? payload.outfitConcept : null);

        const normalized = (Array.isArray(payload.items) ? payload.items : [])
          .map((entry: any) => {
            const p = entry?.product || {};
            return {
              slot: String(entry?.slot || ""),
              subCategory: String(entry?.subCategory || p?.subCategory || ""),
              concept: String(entry?.concept || ""),
              product: {
                ...p,
                id: p.id || String(p._id || p.p_id),
                p_id: Number(p.p_id),
                price: Number(p.price || 0),
                sizes: p.sizes || ["S", "M", "L", "XL", "XXL"],
                stock: p.stock ?? 50,
                outfitSlot: p.outfitSlot || "top",
                subCategory: p.subCategory || "Top",
              } as Product,
            } as OutfitItem;
          })
          .filter((entry: OutfitItem) => Number.isFinite(entry.product.p_id));
        setItems(normalized);
      } catch {
        setItems([]);
        setOutfitConcept(null);
      } finally {
        setLoading(false);
      }
    };

    fetchOutfit();
  }, [sourceProduct.p_id]);

  const filteredItems = useMemo(() => {
    const sourceSlot = sourceProduct.outfitSlot || "";
    const sourceId = String(sourceProduct.id || sourceProduct.p_id || "");

    return items.filter((entry) => {
      const product = entry.product;
      if (!product) return false;
      if ((product.outfitSlot || "") === sourceSlot) return false;
      if (String(product.id || "") === sourceId) return false;
      return true;
    });
  }, [items, sourceProduct.id, sourceProduct.p_id, sourceProduct.outfitSlot]);

  if (loading) {
    return (
      <section className="pt-10 mt-10 border-t border-border">
        <h2 className="font-display text-2xl uppercase tracking-widest mb-6">Style It With</h2>
        <div className="flex gap-5 overflow-x-auto pb-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="min-w-[220px] w-[220px] animate-pulse">
              <div className="w-full h-[280px] bg-muted rounded-sm mb-3" />
              <div className="h-3 bg-muted rounded w-1/2 mb-2" />
              <div className="h-4 bg-muted rounded w-5/6 mb-2" />
              <div className="h-4 bg-muted rounded w-1/3" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (filteredItems.length < 2) return null;

  const handleAddAll = () => {
    let added = 0;
    for (const entry of filteredItems) {
      const product = entry.product;
      if ((product.stock ?? 0) <= 0) continue;
      const defaultSize = product.sizes?.[0] || "M";
      addItem(product, defaultSize);
      added += 1;
    }
    if (added > 0) {
      toast.success("Outfit added to bag! ✨");
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
      {outfitConcept && (
        <p className="font-body text-sm text-muted-foreground mb-5">{outfitConcept}</p>
      )}

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
            {filteredItems.map((entry) => (
              <div key={`${entry.product.p_id}-${entry.slot}`} className="min-w-[220px] w-[220px]">
                <div className="relative aspect-[3/4] overflow-hidden bg-secondary mb-3">
                  <img
                    src={entry.product.image}
                    alt={entry.product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="space-y-2">
                  <span className="inline-block px-2 py-1 text-[10px] font-body uppercase tracking-[0.2em] bg-secondary text-muted-foreground">
                    {entry.subCategory || entry.product.subCategory || "Style Pick"}
                  </span>
                  <p className="font-display text-sm text-foreground line-clamp-2">{entry.product.name}</p>
                  <p className="font-body text-sm text-muted-foreground">
                    LKR {entry.product.price.toLocaleString()}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const size = entry.product.sizes?.[0] || "M";
                      addItem(entry.product, size);
                      toast.success(`${entry.product.name} added to bag`);
                    }}
                    className="w-full py-2 bg-foreground text-background font-body text-xs uppercase tracking-[0.2em] hover:bg-foreground/90 transition-colors"
                  >
                    Add to Bag
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="font-body text-xs text-muted-foreground mt-4">Styled by Calidi AI ✨</p>
    </section>
  );
}
