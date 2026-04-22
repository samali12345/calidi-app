import { useEffect, useMemo, useState } from "react";
import heroImage from "@/assets/hero-1.png";
import { Link } from "react-router-dom";
import { apiFetch } from "@/lib/api";

export default function HeroSection() {
  const [doublePoints, setDoublePoints] = useState<{ active: boolean; endsAt: string | null }>({
    active: false,
    endsAt: null,
  });
  const [nowTs, setNowTs] = useState(Date.now());

  useEffect(() => {
    apiFetch<{ active: boolean; endsAt?: string }>("/settings/double-points")
      .then((status) => {
        setDoublePoints({ active: !!status.active, endsAt: status.endsAt || null });
      })
      .catch(() => {
        setDoublePoints({ active: false, endsAt: null });
      });
  }, []);

  useEffect(() => {
    if (!doublePoints.active || !doublePoints.endsAt) return;
    const timer = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [doublePoints.active, doublePoints.endsAt]);

  const countdownText = useMemo(() => {
    if (!doublePoints.active || !doublePoints.endsAt) return "";
    const endsAtMs = new Date(doublePoints.endsAt).getTime();
    const diff = Math.max(0, endsAtMs - nowTs);
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    return `${hours}h ${minutes}m ${seconds}s`;
  }, [doublePoints.active, doublePoints.endsAt, nowTs]);

  return (
    <section className="relative h-[85vh] min-h-[500px] overflow-hidden">
      <img
        src={heroImage}
        alt="Calidi Clothing Co. - New Collection"
        className="absolute inset-0 w-full h-full object-cover"
        loading="eager"
      />
      <div className="absolute inset-0 bg-foreground/20" />
      {doublePoints.active && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 bg-amber-100/95 text-amber-900 border border-amber-300 rounded-sm px-4 py-2 text-xs font-body tracking-wide">
          Double Points this weekend - earn 2x loyalty points on all orders!
          {countdownText ? ` Ends in ${countdownText}` : ""}
        </div>
      )}
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
