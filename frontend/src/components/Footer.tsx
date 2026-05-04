import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer className="bg-foreground text-background py-16 px-6">
      <div className="container mx-auto grid grid-cols-1 md:grid-cols-4 gap-10">
        <div>
          <h3 className="font-display text-xl font-bold tracking-wider mb-1">CALIDI</h3>
          <p className="text-[10px] tracking-[0.3em] text-background/60 mb-4">CLOTHING CO.</p>
          <p className="font-body text-sm text-background/70 leading-relaxed">
            Timeless pieces crafted with care for the modern wardrobe.
          </p>
        </div>
        <div>
          <h4 className="font-body text-xs uppercase tracking-[0.3em] mb-4 text-background/60">Shop</h4>
          <ul className="space-y-2 font-body text-sm text-background/80">
            <li><Link to="/shop?category=Women" className="hover:text-background transition-colors">Women</Link></li>
            <li><Link to="/shop?category=Men" className="hover:text-background transition-colors">Men</Link></li>
            <li><Link to="/shop?category=Accessories" className="hover:text-background transition-colors">Accessories</Link></li>
            <li><Link to="/shop" className="hover:text-background transition-colors">New Arrivals</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-body text-xs uppercase tracking-[0.3em] mb-4 text-background/60">Help</h4>
          <ul className="space-y-2 font-body text-sm text-background/80">
            <li><Link to="/shipping-returns" className="hover:text-background transition-colors">Shipping & Returns</Link></li>
            <li><Link to="/size-guide" className="hover:text-background transition-colors">Size Guide</Link></li>
            <li><span className="cursor-pointer hover:text-background transition-colors">Contact Us</span></li>
            <li><span className="cursor-pointer hover:text-background transition-colors">FAQ</span></li>
          </ul>
        </div>
        <div>
          <h4 className="font-body text-xs uppercase tracking-[0.3em] mb-4 text-background/60">Follow Us</h4>
          <ul className="space-y-2 font-body text-sm text-background/80">
            <li><span className="cursor-pointer hover:text-background transition-colors">Instagram</span></li>
            <li><span className="cursor-pointer hover:text-background transition-colors">Pinterest</span></li>
            <li><span className="cursor-pointer hover:text-background transition-colors">TikTok</span></li>
          </ul>
        </div>
      </div>
      <div className="container mx-auto mt-12 pt-6 border-t border-background/15">
        <p className="text-center font-body text-xs text-background/50 tracking-wider">
          © 2026 Calidi Clothing Co. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
