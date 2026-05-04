import { useState } from "react";
import { Link } from "react-router-dom";
import type { Product } from "@/lib/types";
import { useCart } from "@/context/CartContext";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addItem } = useCart();

  const initialSize = product.sizes && product.sizes.length > 0 ? product.sizes[0] : "N/A";
  const [selectedSize, setSelectedSize] = useState(initialSize);
  const [showSizes, setShowSizes] = useState(false);

  const isOutOfStock = product.stock !== undefined && product.stock <= 0;
  const isLowStock = product.stock !== undefined && product.stock > 0 && product.lowStockThreshold !== undefined && product.stock <= product.lowStockThreshold;

  const handleAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isOutOfStock) {
      toast.error("This item is out of stock");
      return;
    }
    if (selectedSize === "N/A") {
      toast.error("Please select a size");
      return;
    }
    addItem(product, selectedSize);
    toast.success(`${product.name} added to bag`, {
      description: `Size: ${selectedSize}`,
    });
  };

  return (
    <div className="group">
      <div
        className="relative aspect-[3/4] overflow-hidden bg-secondary mb-4 cursor-pointer"
        onMouseEnter={() => setShowSizes(true)}
        onMouseLeave={() => setShowSizes(false)}
      >
        <img src={product.image} alt={product.name} className={`w-full h-full object-cover ${isOutOfStock ? "opacity-50 grayscale" : ""}`} />

        {/* Stock badge */}
        {isOutOfStock && (
          <div className="absolute top-3 left-3 bg-destructive text-white px-3 py-1 text-xs font-body uppercase tracking-wider">
            Out of Stock
          </div>
        )}
        {isLowStock && (
          <div className="absolute top-3 left-3 bg-amber-500 text-white px-3 py-1 text-xs font-body uppercase tracking-wider flex items-center gap-1">
            <AlertTriangle size={12} />
            Only {product.stock} left
          </div>
        )}

        {/* Quick add overlay */}
        {!isOutOfStock && (
          <div
            className={`absolute inset-x-0 bottom-0 bg-background/95 backdrop-blur-sm p-4 transition-transform duration-300 ${
              showSizes ? "translate-y-0" : "translate-y-full"
            }`}
          >
            <div className="flex flex-wrap gap-2 mb-3">
              {product.sizes?.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setSelectedSize(size);
                  }}
                  className={`px-3 py-1 text-xs font-body uppercase tracking-wider border transition-colors ${
                    selectedSize === size
                      ? "bg-foreground text-background border-foreground"
                      : "bg-transparent text-foreground border-border hover:border-foreground"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
            <button
              onClick={handleAdd}
              className="w-full bg-foreground text-background py-2 font-body text-xs uppercase tracking-[0.2em] hover:bg-foreground/90 transition-colors"
            >
              Add to Bag
            </button>
          </div>
        )}
      </div>

      <Link to={`/product/${product.p_id}`} className="block space-y-1">
        <h3 className="font-display text-sm font-medium text-foreground hover:underline">
          {product.name}
        </h3>
        <p className="font-body text-sm text-muted-foreground">
          LKR {product.price.toLocaleString()}
        </p>
        {product.stock !== undefined && !isOutOfStock && !isLowStock && (
          <p className="font-body text-xs text-muted-foreground">
            In Stock: {product.stock}
          </p>
        )}
      </Link>
    </div>
  );
}
