import { useEffect, useState } from "react";
import axios from "axios";
import ProductCard from "./ProductCard";
import { Link } from "react-router-dom";
import type { Product } from "@/lib/types";

export default function FeaturedProducts() {
  const [featured, setFeatured] = useState<Product[]>([]);

  useEffect(() => {
    axios
      .get("http://127.0.0.1:5000/api/products")
      .then((res) => {
        // Sort by p_id descending to get newest items first
        const sorted = [...res.data].sort((a: any, b: any) => (b.p_id || 0) - (a.p_id || 0));
        const items = sorted.slice(0, 4).map((p: any) => ({
          ...p,
          id: p.id || String(p._id || p.p_id),
          sizes: p.sizes || ["S", "M", "L", "XL", "XXL"],
          price: p.price || 2999,
        }));
        setFeatured(items);
      })
      .catch((err) => console.error("Failed to fetch featured products:", err));
  }, []);

  if (featured.length === 0) return null;

  return (
    <section className="py-20 px-6 bg-secondary/50">
      <div className="container mx-auto">
        <h2 className="font-display text-3xl md:text-4xl text-center text-foreground mb-4">
          New Arrivals
        </h2>
        <p className="font-body text-center text-muted-foreground mb-12">
          The latest additions to our curated collection
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {featured.map((product) => (
            <ProductCard key={product.p_id} product={product} />
          ))}
        </div>
        <div className="text-center mt-12">
          <Link
            to="/shop?category=New"
            className="inline-block border border-foreground text-foreground px-10 py-3 font-body text-sm uppercase tracking-[0.3em] hover:bg-foreground hover:text-background transition-all duration-300"
          >
            View All New Arrivals
          </Link>
        </div>
      </div>
    </section>
  );
}
