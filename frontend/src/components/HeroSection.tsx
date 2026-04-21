import heroImage from "@/assets/hero-1.png";
import { Link } from "react-router-dom";

export default function HeroSection() {
  return (
    <section className="relative h-[85vh] min-h-[500px] overflow-hidden">
      <img
        src={heroImage}
        alt="Calidi Clothing Co. - New Collection"
        className="absolute inset-0 w-full h-full object-cover"
        loading="eager"
      />
      <div className="absolute inset-0 bg-foreground/20" />
      <div className="relative z-10 flex flex-col items-center justify-center h-full text-center px-6">
        <p className="font-body text-sm tracking-[0.4em] uppercase text-background/90 mb-4">
          New Season
        </p>
        <h2 className="font-display text-5xl md:text-7xl font-bold text-background leading-tight">
          Effortless
          <br />
          Elegance
        </h2>
        <p className="font-body text-lg text-background/80 mt-4 max-w-md">
          Discover timeless pieces crafted for the modern wardrobe
        </p>
        <Link
          to="/shop"
          className="mt-8 inline-block border border-background text-background px-10 py-3 font-body text-sm uppercase tracking-[0.3em] hover:bg-background hover:text-foreground transition-all duration-300"
        >
          Shop Now
        </Link>
      </div>
    </section>
  );
}
