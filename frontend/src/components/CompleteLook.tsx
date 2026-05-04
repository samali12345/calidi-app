import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useCart } from "@/context/CartContext";
import { toast } from "sonner";
import type { Product } from "@/lib/types";

type CompleteLookProps = {
  currentProductId?: string | null;
};

export default function CompleteLook({ currentProductId }: CompleteLookProps) {
  const [items, setItems] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { addItem } = useCart();

  useEffect(() => {
    const load = async () => {
      if (!currentProductId) {
        setItems([]);
        return;
      }

      try {
        setLoading(true);
        const res = await axios.get(
          `http://127.0.0.1:5000/api/products/complete-look/${encodeURIComponent(currentProductId)}`
        );
        const mapped = (Array.isArray(res.data) ? res.data : []).map((p: any) => ({
          ...p,
          id: p.id || String(p._id || p.p_id),
          p_id: Number(p.p_id),
          price: Number(p.price ?? 0),
          sizes: p.sizes || ["S", "M", "L", "XL", "XXL"],
        }));
        setItems(mapped);
      } catch {
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [currentProductId]);

  if (loading) {
    return (
      <section className="pt-10 mt-10 border-t border-border">
        <h2 className="font-display text-2xl uppercase tracking-widest mb-6">Complete The Look</h2>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="min-w-[220px] w-[220px] animate-pulse">
              <div className="w-full h-[280px] bg-muted rounded-sm mb-3" />
              <div className="h-4 bg-muted rounded w-5/6 mb-2" />
              <div className="h-4 bg-muted rounded w-2/5" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (items.length < 2) return null;

  return (
    <section className="pt-10 mt-10 border-t border-border">
      <h2 className="font-display text-2xl uppercase tracking-widest mb-6">Complete The Look</h2>
      <div className="flex gap-5 overflow-x-auto pb-2">
        {items.map((product) => (
          <article
            key={product.p_id}
            className="min-w-[240px] w-[240px] cursor-pointer"
            onClick={() => navigate(`/product/${product.p_id}`)}
          >
            <div className="relative aspect-[3/4] overflow-hidden bg-secondary">
              <img
                src={product.image}
                alt={product.name}
                className="w-full h-full object-cover"
              />
              {product.category && (
                <span className="absolute top-2 left-2 text-[10px] font-body uppercase tracking-wider bg-background/90 px-2 py-1 border border-border">
                  {product.category}
                </span>
              )}
            </div>
            <div className="mt-3 space-y-1">
              <p className="font-display text-sm line-clamp-2">{product.name}</p>
              <p className="font-body text-sm text-muted-foreground">
                LKR {Number(product.price || 0).toLocaleString()}
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const size = product.sizes?.[0] || "M";
                  addItem(product, size);
                  toast.success(`${product.name} added to bag`, {
                    description: `Size: ${size}`,
                  });
                }}
                className="mt-2 w-full bg-foreground text-background py-2 font-body text-xs uppercase tracking-[0.2em] hover:bg-foreground/90 transition-colors"
              >
                Add to Bag
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
