import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import ProductCard from "./ProductCard";
import type { Product } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";

const API_BASE = import.meta.env.VITE_API_URL || "http://127.0.0.1:5000/api";

export default function BrowsingRecommendations() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Product[]>([]);

  const userId = useMemo(() => {
    return user?.id || "";
  }, [user?.id]);

  useEffect(() => {
    const fetchBrowsingRecs = async () => {
      if (!userId) {
        setItems([]);
        return;
      }

      try {
        setLoading(true);
        const res = await axios.get(`${API_BASE}/products/recommendations/browsing/${encodeURIComponent(userId)}`, {
          params: { top_n: 8 },
        });

        const normalized = (res.data || []).map((p: any) => ({
          ...p,
          id: p.id || String(p._id || p.p_id),
          sizes: p.sizes || ["S", "M", "L", "XL", "XXL"],
          price: p.price || 0,
        }));
        setItems(normalized);
      } catch {
        // Silent fail per requirement.
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchBrowsingRecs();
  }, [userId]);

  if (!userId) return null;

  if (loading) {
    return (
      <section className="py-14 px-6">
        <div className="container mx-auto">
          <h2 className="font-display text-2xl md:text-3xl text-foreground mb-6">
            Recently Viewed - You Might Also Like
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="min-w-[230px] w-[230px] space-y-3 animate-pulse">
                <div className="w-full h-[300px] bg-muted rounded-sm"></div>
                <div className="h-4 bg-muted rounded w-5/6"></div>
                <div className="h-4 bg-muted rounded w-1/3"></div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (items.length < 3) return null;

  return (
    <section className="py-14 px-6">
      <div className="container mx-auto">
        <h2 className="font-display text-2xl md:text-3xl text-foreground mb-6">
          Recently Viewed - You Might Also Like
        </h2>

        <div className="flex gap-5 overflow-x-auto pb-2">
          {items.map((product) => (
            <div key={product.p_id} className="min-w-[240px] w-[240px]">
              <ProductCard product={product} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
