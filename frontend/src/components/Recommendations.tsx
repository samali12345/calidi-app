import { useEffect, useState } from "react";
import axios from "axios";
import ProductCard from "./ProductCard";
import type { Product } from "@/lib/types";

export default function Recommendations({ currentProductId }: { currentProductId: string | number }) {
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchRecs = async () => {
      if (!currentProductId) return;

      try {
        setLoading(true);
        setError(false);
        const res = await axios.get(
          `http://127.0.0.1:5000/api/products/recommendations/${currentProductId}`
        );

        const recs = res.data.map((p: any) => ({
          ...p,
          id: p.id || String(p._id || p.p_id),
          sizes: p.sizes || ["S", "M", "L", "XL", "XXL"],
          price: p.price || 0,
        }));
        setRecommendations(recs);
      } catch (err) {
        console.error("Failed to fetch recommendations:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchRecs();
  }, [currentProductId]);

  if (loading) {
    return (
      <div className="py-12 border-t mt-12">
        <h2 className="font-display text-2xl uppercase tracking-widest mb-8">You May Also Like</h2>
        <div className="flex items-center justify-center py-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mr-3"></div>
          <span className="text-muted-foreground font-body">AI is finding similar styles...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-12 border-t mt-12">
        <h2 className="font-display text-2xl uppercase tracking-widest mb-8">You May Also Like</h2>
        <p className="text-center text-muted-foreground font-body py-10">
          Recommendation service is offline. Start the Python service to see AI recommendations.
        </p>
      </div>
    );
  }

  if (recommendations.length === 0) return null;

  return (
    <div className="py-12 border-t mt-12">
      <div className="flex items-center gap-3 mb-8">
        <h2 className="font-display text-2xl uppercase tracking-widest">You May Also Like</h2>
        <span className="text-xs font-body uppercase tracking-widest text-muted-foreground bg-secondary px-3 py-1 rounded-full">
          AI Powered
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {recommendations.map((prod) => (
          <ProductCard key={prod.p_id} product={prod} />
        ))}
      </div>
    </div>
  );
}
