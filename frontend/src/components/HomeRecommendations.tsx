import { useEffect, useState } from "react";
import axios from "axios";
import ProductCard from "./ProductCard";
import type { Product } from "@/lib/types";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";

export default function HomeRecommendations() {
  const { user, token } = useAuth();
  const [seedProduct, setSeedProduct] = useState<Product | null>(null);
  const [recommendations, setRecommendations] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"user" | "seed">("seed");

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        // Use user-history mode only if the user has at least one paid order.
        let hasPaidOrders = false;
        if (user?.id && token) {
          try {
            const orders = await apiFetch<Array<{ status: string }>>("/orders", { token });
            hasPaidOrders = Array.isArray(orders) && orders.some((o) => o.status === "paid");
          } catch {
            hasPaidOrders = false;
          }
        }

        if (user?.id && hasPaidOrders) {
          const userRecRes = await axios.get(
            `http://127.0.0.1:5000/api/products/recommendations/user/${encodeURIComponent(user.id)}`,
            { params: { top_n: 8 } }
          );

          const userRecs = (userRecRes.data || []).map((p: any) => ({
            ...p,
            id: p.id || String(p._id || p.p_id),
            sizes: p.sizes || ["S", "M", "L", "XL", "XXL"],
            price: p.price || 2999,
          }));

          if (userRecs.length > 0) {
            setMode("user");
            setRecommendations(userRecs);
            setSeedProduct(null);
            return;
          }
        }

        // Fetch products list, pick a random one as seed
        const productsRes = await axios.get("http://127.0.0.1:5000/api/products");
        const products = productsRes.data;
        if (products.length === 0) return;

        // Pick a random product from the first 50
        const seed = products[Math.floor(Math.random() * Math.min(50, products.length))];
        setSeedProduct({
          ...seed,
          id: seed.id || String(seed._id || seed.p_id),
          sizes: seed.sizes || ["S", "M", "L", "XL", "XXL"],
          price: seed.price || 2999,
        });

        // Fetch AI recommendations for this product
        const recRes = await axios.get(
          `http://127.0.0.1:5000/api/products/recommendations/${seed.p_id}`
        );
        const recs = recRes.data.map((p: any) => ({
          ...p,
          id: p.id || String(p._id || p.p_id),
          sizes: p.sizes || ["S", "M", "L", "XL", "XXL"],
          price: p.price || 2999,
        }));
        setMode("seed");
        setRecommendations(recs);
      } catch (err) {
        console.error("Failed to fetch home recommendations:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchRecommendations();
  }, [user?.id, token]);

  if (loading) {
    return (
      <section className="py-20 px-6">
        <div className="container mx-auto text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground text-sm uppercase tracking-widest">
            AI is finding styles for you...
          </p>
        </div>
      </section>
    );
  }

  if (recommendations.length === 0) return null;

  return (
    <section className="py-20 px-6">
      <div className="container mx-auto">
        <div className="text-center mb-4">
          <p className="font-body text-xs uppercase tracking-[0.3em] text-muted-foreground mb-2">
            Powered by AI
          </p>
          <h2 className="font-display text-3xl md:text-4xl text-foreground">
            {mode === "user" ? "Based On Your Purchases" : "Styled By Our Model"}
          </h2>
        </div>

        {mode === "seed" && seedProduct && (
          <p className="text-center text-muted-foreground font-body text-sm mb-12">
            Because you viewed{" "}
            <Link
              to={`/product/${seedProduct.p_id}`}
              className="text-foreground underline underline-offset-4"
            >
              {seedProduct.name}
            </Link>
          </p>
        )}

        {mode === "user" && (
          <p className="text-center text-muted-foreground font-body text-sm mb-12">
            Personalized picks from your purchase history
          </p>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {recommendations.map((product) => (
            <ProductCard key={product.p_id} product={product} />
          ))}
        </div>

        <div className="text-center mt-12">
          <Link
            to="/shop"
            className="inline-block border border-foreground text-foreground px-10 py-3 font-body text-sm uppercase tracking-[0.3em] hover:bg-foreground hover:text-background transition-all duration-300"
          >
            Explore More
          </Link>
        </div>
      </div>
    </section>
  );
}
