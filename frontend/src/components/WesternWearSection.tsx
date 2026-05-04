import { useEffect, useState } from "react";
import axios from "axios";
import ProductCard from "./ProductCard";
import { Link } from "react-router-dom";
import type { Product } from "@/lib/types";

export default function WesternWearSection() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    axios
      .get("http://127.0.0.1:5000/api/products")
      .then((res) => {
        const westernItems = res.data
          .filter((p: any) => {
            const searchArea = `${p.name || ""} ${p.brand || ""} ${p.description || ""} ${p.category || ""}`.toLowerCase();
            return searchArea.includes("western");
          })
          .slice(0, 4)
          .map((p: any) => ({
            ...p,
            id: p.id || String(p._id || p.p_id),
            sizes: p.sizes || ["S", "M", "L", "XL", "XXL"],
            price: p.price || 2999,
          }));
        setProducts(westernItems);
      })
      .catch((err) => console.error("Failed to fetch western wear:", err));
  }, []);

  if (products.length === 0) return null;

  return (
    <section className="py-20 px-6">
      <div className="container mx-auto">
        <h2 className="font-display text-3xl md:text-4xl text-center text-foreground mb-4">
          Western Wear
        </h2>
        <p className="font-body text-center text-muted-foreground mb-12">
          Contemporary styles for the modern woman
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard key={product.p_id} product={product} />
          ))}
        </div>
        <div className="text-center mt-12">
          <Link
            to="/shop?category=Western"
            className="inline-block border border-foreground text-foreground px-10 py-3 font-body text-sm uppercase tracking-[0.3em] hover:bg-foreground hover:text-background transition-all duration-300"
          >
            Shop Western Wear
          </Link>
        </div>
      </div>
    </section>
  );
}
