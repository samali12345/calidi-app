import { ShoppingBag, Menu, X, User, LogOut, LayoutDashboard, Truck } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import LoyaltyBadge from "@/components/LoyaltyBadge";

export default function Navbar() {
  const { totalItems, setIsOpen } = useCart();
  const { user, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleSignOut = () => {
    signOut();
    toast.success("Signed out");
    navigate("/");
  };

  return (
    <header className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
      <nav className="container mx-auto flex items-center justify-between px-6 py-4">
        <Link to="/" className="font-display text-2xl font-bold tracking-wider text-foreground">
          CALIDI
          <p className="text-[10px] tracking-[0.3em] text-muted-foreground text-center">WOMEN'S CLOTHING</p>
        </Link>

        <ul className="hidden md:flex items-center gap-8 font-body text-sm tracking-widest uppercase text-muted-foreground">
          <li><Link to="/" className="hover:text-foreground">Home</Link></li>
          <li><Link to="/shop" className="hover:text-foreground">Shop All</Link></li>
          <li><Link to="/shop?category=Ethnic" className="hover:text-foreground">Ethnic Wear</Link></li>
          <li><Link to="/shop?category=Western" className="hover:text-foreground">Western Wear</Link></li>
        </ul>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              {user.role === "admin" && (
                <Link to="/admin" className="text-foreground hover:text-muted-foreground" title="Admin Dashboard">
                  <LayoutDashboard size={20} />
                </Link>
              )}
              {user.isRider && (
                <Link to="/rider/dashboard" className="text-foreground hover:text-muted-foreground" title="Rider Dashboard">
                  <Truck size={20} />
                </Link>
              )}
              {user.loyaltyTier && user.loyaltyTier !== "none" && (
                <Link to="/profile">
                  <LoyaltyBadge tier={user.loyaltyTier} size="sm" />
                </Link>
              )}
              <Link to="/profile" className="text-foreground hover:text-muted-foreground" title="Profile">
                <User size={20} />
              </Link>
              <button onClick={handleSignOut} className="text-foreground hover:text-muted-foreground" title="Sign Out">
                <LogOut size={20} />
              </button>
            </>
          ) : (
            <Link to="/auth" className="text-foreground hover:text-muted-foreground"><User size={20} /></Link>
          )}
          <button onClick={() => setIsOpen(true)} className="relative text-foreground hover:text-muted-foreground">
            <ShoppingBag size={22} />
            {totalItems > 0 && (
              <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
                {totalItems}
              </span>
            )}
          </button>
        </div>
      </nav>
    </header>
  );
}
