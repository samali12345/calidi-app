import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from "react";
import type { CartItem, Product } from "@/lib/types";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, size: string) => void;
  removeItem: (productId: string, size: string) => void;
  updateQuantity: (productId: string, size: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  deliveryFee: number;
  freeDeliveryItemsNeeded: number;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const { user, token } = useAuth();

  const addItem = useCallback((product: Product, size: string) => {
    setItems((prev) => {
      const existing = prev.find(
        (i) => i.product.id === product.id && i.size === size
      );
      // Check stock limit
      const currentQty = existing ? existing.quantity : 0;
      const stock = product.stock ?? 50;
      if (currentQty >= stock) {
        return prev; // Don't exceed available stock
      }
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id && i.size === size
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { product, quantity: 1, size }];
    });
    setIsOpen(true);
  }, []);

  const removeItem = useCallback((productId: string, size: string) => {
    setItems((prev) =>
      prev.filter((i) => !(i.product.id === productId && i.size === size))
    );
  }, []);

  const updateQuantity = useCallback(
    (productId: string, size: string, quantity: number) => {
      if (quantity <= 0) {
        removeItem(productId, size);
        return;
      }
      setItems((prev) =>
        prev.map((i) => {
          if (i.product.id === productId && i.size === size) {
            const stock = i.product.stock ?? 50;
            return { ...i, quantity: Math.min(quantity, stock) };
          }
          return i;
        })
      );
    },
    [removeItem]
  );

  const clearCart = useCallback(() => setItems([]), []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce(
    (sum, i) => sum + i.product.price * i.quantity,
    0
  );
  const deliveryFee = totalItems >= 5 ? 0 : 350;
  const freeDeliveryItemsNeeded = Math.max(0, 5 - totalItems);

  useEffect(() => {
    if (!user || !token) return;

    const timeout = setTimeout(() => {
      const payloadItems = items.map((item) => ({
        productId: item.product.p_id,
        name: item.product.name,
        size: item.size,
        quantity: item.quantity,
        unitPrice: item.product.price,
      }));

      void apiFetch("/cart/activity", {
        method: "POST",
        token,
        body: {
          items: payloadItems,
          totalValue: totalPrice,
        },
      }).catch(() => {});
    }, 3000);

    return () => clearTimeout(timeout);
  }, [items, totalPrice, user, token]);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        totalPrice,
        deliveryFee,
        freeDeliveryItemsNeeded,
        isOpen,
        setIsOpen,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within CartProvider");
  return context;
}
