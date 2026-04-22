import { useParams, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";
import Recommendations from "@/components/Recommendations";
import CompleteLook from "@/components/CompleteLook";
import OutfitBuilder from "@/components/OutfitBuilder";
import type { Product } from "@/lib/types";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Star, AlertTriangle, Truck, Shield, RotateCcw, ChevronRight } from "lucide-react";
import { Separator } from "@/components/ui/separator";

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [selectedSize, setSelectedSize] = useState<string>("S");
  const { addItem } = useCart();
  const { token } = useAuth();

  useEffect(() => {
    const fetchProduct = async () => {
      const res = await axios.get(`http://127.0.0.1:5000/api/products/${id}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      setProduct(res.data);
      if (res.data.sizes?.length > 0) {
        setSelectedSize(res.data.sizes[0]);
      }
    };
    fetchProduct();
  }, [id, token]);

  if (!product) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
  );

  const isOutOfStock = product.stock !== undefined && product.stock <= 0;
  const isLowStock = product.stock !== undefined && product.stock > 0 && product.lowStockThreshold !== undefined && product.stock <= product.lowStockThreshold;

  const handleAddToBag = () => {
    if (isOutOfStock) {
      toast.error("This item is currently out of stock");
      return;
    }
    addItem(product, selectedSize);
    toast.success(`${product.name} added to bag`, {
      description: `Size: ${selectedSize}`,
    });
  };

  return (
    <div className="container mx-auto px-6 py-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 font-body text-xs text-muted-foreground uppercase tracking-widest mb-8">
        <Link to="/" className="hover:text-foreground transition-colors">Home</Link>
        <ChevronRight size={12} />
        <Link to="/shop" className="hover:text-foreground transition-colors">Shop</Link>
        {product.category && (
          <>
            <ChevronRight size={12} />
            <Link to={`/shop?category=${product.category}`} className="hover:text-foreground transition-colors">
              {product.category}
            </Link>
          </>
        )}
        <ChevronRight size={12} />
        <span className="text-foreground">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mb-20">
        {/* Product Image */}
        <div className="relative">
          <img
            src={product.image}
            alt={product.name}
            className={`w-full aspect-[3/4] object-cover bg-secondary ${isOutOfStock ? "opacity-50 grayscale" : ""}`}
          />
          {isOutOfStock && (
            <div className="absolute top-4 left-4 bg-destructive text-white px-4 py-2 text-sm font-body uppercase tracking-wider">
              Out of Stock
            </div>
          )}
          {isLowStock && (
            <div className="absolute top-4 left-4 bg-amber-500 text-white px-4 py-2 text-sm font-body uppercase tracking-wider flex items-center gap-2">
              <AlertTriangle size={14} />
              Only {product.stock} left
            </div>
          )}
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          {/* Category badge */}
          {product.category && (
            <Link
              to={`/shop?category=${product.category}`}
              className="inline-block font-body text-xs uppercase tracking-[0.2em] text-muted-foreground border border-border px-3 py-1 hover:border-foreground transition-colors"
            >
              {product.category}
            </Link>
          )}

          <h1 className="text-3xl font-display">{product.name}</h1>

          {product.brand && (
            <p className="text-sm text-muted-foreground uppercase tracking-widest">{product.brand}</p>
          )}

          {/* Rating */}
          {product.avg_rating !== undefined && product.avg_rating > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={16}
                    className={i < Math.round(product.avg_rating!) ? "fill-amber-400 text-amber-400" : "text-gray-300"}
                  />
                ))}
              </div>
              <span className="font-body text-sm text-muted-foreground">
                {product.avg_rating.toFixed(1)}
                {product.ratingCount !== undefined && ` (${product.ratingCount} reviews)`}
              </span>
            </div>
          )}

          <p className="text-2xl font-display">LKR {product.price.toLocaleString()}</p>

          {/* Stock status */}
          {product.stock !== undefined && (
            <div className="font-body text-sm">
              {isOutOfStock ? (
                <span className="text-destructive font-medium">Out of Stock</span>
              ) : isLowStock ? (
                <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                  <AlertTriangle size={14} />
                  Only {product.stock} left - order soon!
                </span>
              ) : (
                <span className="text-green-600 dark:text-green-400">In Stock ({product.stock} available)</span>
              )}
            </div>
          )}

          <Separator />

          {/* Description */}
          <div className="space-y-3">
            <h3 className="font-display text-sm uppercase tracking-widest text-foreground">Description</h3>
            <p className="text-muted-foreground font-body leading-relaxed">
              {product.description || "A beautifully crafted piece from our curated collection, designed with attention to detail and quality fabrics for the modern woman."}
            </p>
          </div>

          {/* Product details */}
          {(product.colour || product.brand || product.category) && (
            <div className="space-y-3">
              <h3 className="font-display text-sm uppercase tracking-widest text-foreground">Details</h3>
              <div className="grid grid-cols-2 gap-y-2 font-body text-sm">
                {product.brand && (
                  <>
                    <span className="text-muted-foreground">Brand</span>
                    <span className="text-foreground">{product.brand}</span>
                  </>
                )}
                {product.colour && (
                  <>
                    <span className="text-muted-foreground">Colour</span>
                    <span className="text-foreground capitalize">{product.colour}</span>
                  </>
                )}
                {product.category && (
                  <>
                    <span className="text-muted-foreground">Category</span>
                    <span className="text-foreground">{product.category}</span>
                  </>
                )}
              </div>
            </div>
          )}

          <Separator />

          {/* Size Selector */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="font-body text-xs uppercase tracking-widest text-muted-foreground">Size</p>
              <Link to="/size-guide" className="font-body text-xs text-muted-foreground underline hover:text-foreground">
                Size Guide
              </Link>
            </div>
            <div className="flex flex-wrap gap-2">
              {product.sizes?.map((size) => (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  className={`px-4 py-2 text-xs font-body uppercase tracking-wider border transition-colors ${
                    selectedSize === size
                      ? "bg-foreground text-background border-foreground"
                      : "bg-transparent text-foreground border-border hover:border-foreground"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleAddToBag}
            disabled={isOutOfStock}
            className={`w-full py-4 uppercase tracking-widest transition-colors font-body ${
              isOutOfStock
                ? "bg-muted text-muted-foreground cursor-not-allowed"
                : "bg-foreground text-background hover:bg-foreground/90"
            }`}
          >
            {isOutOfStock ? "Out of Stock" : "Add to Bag"}
          </button>

          {/* Features */}
          <div className="grid grid-cols-3 gap-4 pt-4">
            <div className="text-center space-y-2">
              <Truck size={20} className="mx-auto text-muted-foreground" />
              <p className="font-body text-xs text-muted-foreground">Free delivery on 5+ items</p>
            </div>
            <div className="text-center space-y-2">
              <Shield size={20} className="mx-auto text-muted-foreground" />
              <p className="font-body text-xs text-muted-foreground">Secure checkout</p>
            </div>
            <div className="text-center space-y-2">
              <RotateCcw size={20} className="mx-auto text-muted-foreground" />
              <p className="font-body text-xs text-muted-foreground">Easy returns</p>
            </div>
          </div>
        </div>
      </div>

      {/* AI Recommendation Section */}
      <Recommendations currentProductId={product.p_id} />
      <OutfitBuilder sourceProduct={product} />
      <CompleteLook currentProductId={product.id} />
    </div>
  );
}
