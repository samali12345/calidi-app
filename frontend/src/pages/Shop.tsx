import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import axios from "axios";
import ProductCard from "@/components/ProductCard";
import type { Product } from "@/lib/types";

export default function Shop() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  const categoryFilter = searchParams.get("category");

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const response = await axios.get("http://127.0.0.1:5000/api/products");

        let allItems = response.data.map((p: any) => ({
          ...p,
          id: p.id || String(p._id || p.p_id),
          sizes: p.sizes || ["S", "M", "L", "XL", "XXL"],
          price: p.price || 2999,
        }));

        // Filter by category
        if (categoryFilter && categoryFilter !== "All") {
          if (categoryFilter === "New") {
            // New Arrivals: sort by newest (highest p_id) and take first 12
            allItems = [...allItems].sort((a: any, b: any) => (b.p_id || 0) - (a.p_id || 0)).slice(0, 12);
          } else {
            allItems = allItems.filter((p: any) => {
              const name = p.name || "";
              const brand = p.brand || "";
              const desc = p.description || "";
              const cat = p.category || "";
              const searchArea = `${name} ${brand} ${desc} ${cat}`.toLowerCase();
              return searchArea.includes(categoryFilter.toLowerCase());
            });
          }
        }

        setProducts(allItems.slice(0, 24));
      } catch (error: any) {
        console.error("Failed to fetch products", error);
        setError(error?.message || "Could not connect to the server. Make sure the backend is running.");
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [categoryFilter]);

  const getTitle = () => {
    if (!categoryFilter) return "All Products";
    if (categoryFilter === "New") return "New Arrivals";
    if (categoryFilter === "Ethnic") return "Ethnic Collection";
    if (categoryFilter === "Western") return "Western Wear";
    return categoryFilter;
  };

  const getSubtitle = () => {
    if (categoryFilter === "New") return "The latest additions to our collection";
    if (categoryFilter === "Ethnic") return "Traditional elegance for every occasion";
    if (categoryFilter === "Western") return "Contemporary styles for the modern woman";
    return `${products.length} curated pieces found`;
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
      <p className="font-display text-xl uppercase tracking-widest">Curating Your Collection...</p>
    </div>
  );

  return (
    <div className="container mx-auto px-6 py-12">
      <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-4">
        <div>
          <h1 className="font-display text-5xl uppercase tracking-tighter">
            {getTitle()}
          </h1>
          <p className="text-muted-foreground mt-2 tracking-widest uppercase text-sm">
            {getSubtitle()}
          </p>
        </div>
        <div className="flex gap-4 text-xs uppercase tracking-widest">
          <Link to="/shop" className={!categoryFilter ? "font-bold border-b border-black dark:border-white" : "text-muted-foreground hover:text-foreground transition-colors"}>All</Link>
          <Link to="/shop?category=New" className={categoryFilter === "New" ? "font-bold border-b border-black dark:border-white" : "text-muted-foreground hover:text-foreground transition-colors"}>New Arrivals</Link>
          <Link to="/shop?category=Ethnic" className={categoryFilter === "Ethnic" ? "font-bold border-b border-black dark:border-white" : "text-muted-foreground hover:text-foreground transition-colors"}>Ethnic</Link>
          <Link to="/shop?category=Western" className={categoryFilter === "Western" ? "font-bold border-b border-black dark:border-white" : "text-muted-foreground hover:text-foreground transition-colors"}>Western</Link>
        </div>
      </div>

      <hr className="mb-12 border-gray-100 dark:border-gray-800" />

      {error ? (
        <div className="text-center py-32 border border-dashed border-red-200 rounded-2xl bg-red-50/50 dark:bg-red-950/20">
          <p className="text-red-500 font-display text-lg mb-2">Backend Unavailable</p>
          <p className="text-muted-foreground font-body text-sm max-w-md mx-auto">{error}</p>
        </div>
      ) : products.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-x-8 gap-y-16">
          {products.map((product) => (
            <ProductCard key={product.p_id} product={product} />
          ))}
        </div>
      ) : (
        <div className="text-center py-32 border border-dashed rounded-2xl bg-gray-50/50 dark:bg-gray-900/20">
          <p className="text-muted-foreground font-display text-lg">No items match this selection.</p>
          <Link to="/shop" className="bg-foreground text-background px-8 py-3 mt-6 inline-block uppercase tracking-widest text-xs hover:bg-foreground/90 transition-colors">
            Return to Shop
          </Link>
        </div>
      )}
    </div>
  );
}
