import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/context/CartContext";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Clock, CreditCard, XCircle } from "lucide-react";
import type { Order } from "@/lib/types";

export default function Payment() {
  const { orderId } = useParams<{ orderId: string }>();
  const { token } = useAuth();
  const { clearCart } = useCart();
  const navigate = useNavigate();

  const [order, setOrder] = useState<Order | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const [paying, setPaying] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [expired, setExpired] = useState(false);
  const [doublePoints, setDoublePoints] = useState<{ active: boolean; endsAt: string | null }>({
    active: false,
    endsAt: null,
  });

  // Simulated card form state
  const [card, setCard] = useState({ number: "", expiry: "", cvv: "", name: "" });
  const [expiryError, setExpiryError] = useState("");

  const handleExpiryChange = (value: string) => {
    // Remove non-digits
    let digits = value.replace(/\D/g, "");
    // Auto-insert slash after 2 digits
    if (digits.length >= 2) {
      digits = digits.slice(0, 2) + "/" + digits.slice(2, 4);
    }
    const formatted = digits.slice(0, 5);
    setCard({ ...card, expiry: formatted });

    // Validate MM/YY
    setExpiryError("");
    if (formatted.length === 5) {
      const [mm, yy] = formatted.split("/").map(Number);
      if (mm < 1 || mm > 12) {
        setExpiryError("Month must be 01-12");
      } else {
        const now = new Date();
        const currentYear = now.getFullYear() % 100;
        const currentMonth = now.getMonth() + 1;
        if (yy < currentYear || (yy === currentYear && mm < currentMonth)) {
          setExpiryError("Card has expired");
        }
      }
    }
  };

  useEffect(() => {
    if (!orderId || !token) return;
    apiFetch<Order>(`/orders/${orderId}`, { token })
      .then((data) => {
        setOrder(data);
        if (data.status !== "pending") {
          if (data.status === "paid") navigate(`/payment-success/${data.orderId}`);
          else setExpired(true);
        }
      })
      .catch(() => toast.error("Failed to load order"));
  }, [orderId, token, navigate]);

  useEffect(() => {
    apiFetch<{ active: boolean; endsAt?: string }>("/settings/double-points")
      .then((status) => {
        setDoublePoints({ active: !!status.active, endsAt: status.endsAt || null });
      })
      .catch(() => {
        setDoublePoints({ active: false, endsAt: null });
      });
  }, []);

  // Countdown timer
  useEffect(() => {
    if (!order || order.status !== "pending") return;

    const updateTimer = () => {
      const remaining = Math.max(0, new Date(order.expiresAt).getTime() - Date.now());
      setTimeLeft(remaining);
      if (remaining <= 0) setExpired(true);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [order]);

  const formatTime = (ms: number) => {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, "0")}`;
  };

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId || !token) return;
    setPaying(true);
    try {
      await apiFetch(`/orders/${orderId}/pay`, { method: "POST", token });
      clearCart();
      toast.success("Payment successful!");
      navigate(`/payment-success/${orderId}`);
    } catch (err: any) {
      toast.error(err.message || "Payment failed");
    } finally {
      setPaying(false);
    }
  };

  const handleCancel = async () => {
    if (!orderId || !token) return;
    setCancelling(true);
    try {
      await apiFetch(`/orders/${orderId}/cancel`, { method: "POST", token });
      toast.success("Order cancelled");
      navigate("/shop");
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel");
    } finally {
      setCancelling(false);
    }
  };

  if (!order) {
    return (
      <main className="min-h-[70vh] flex items-center justify-center">
        <p className="font-body text-muted-foreground">Loading order...</p>
      </main>
    );
  }

  if (expired) {
    return (
      <main className="min-h-[70vh] flex flex-col items-center justify-center px-6 py-16 text-center space-y-6">
        <XCircle size={56} className="text-destructive" />
        <h1 className="font-display text-3xl font-bold tracking-wider text-foreground">Order Expired</h1>
        <p className="font-body text-muted-foreground max-w-md">
          Your order has expired and stock has been restored. Please try again.
        </p>
        <Button
          onClick={() => navigate("/shop")}
          className="bg-foreground text-background hover:bg-foreground/90 font-body uppercase tracking-widest text-sm py-6 px-10 rounded-sm"
        >
          Back to Shop
        </Button>
      </main>
    );
  }

  const timerUrgent = timeLeft < 120000;
  const timerWarning = timeLeft < 300000 && !timerUrgent;

  return (
    <>
      {/* Sticky countdown banner at top */}
      <div className={`sticky top-0 z-50 w-full py-3 px-6 text-center font-body text-sm tracking-wider flex items-center justify-center gap-2 transition-colors ${
        timerUrgent
          ? "bg-destructive text-white animate-pulse"
          : timerWarning
          ? "bg-amber-500 text-white"
          : "bg-foreground text-background"
      }`}>
        <Clock size={16} />
        <span>Complete your payment within <strong>{formatTime(timeLeft)}</strong></span>
        {timerUrgent && <span className="ml-2 text-xs">(Hurry! Order will expire soon)</span>}
      </div>

    <main className="min-h-[70vh] py-12 px-6">
      <div className="container mx-auto max-w-4xl">
        <div className="flex items-center justify-between mb-10">
          <h1 className="font-display text-3xl font-bold tracking-wider text-foreground">
            Complete Payment
          </h1>
          <div className={`flex items-center gap-2 font-body text-sm ${timerUrgent ? "text-destructive" : "text-muted-foreground"}`}>
            <Clock size={16} />
            <span>{formatTime(timeLeft)}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-10">
          {/* Left - Payment Form */}
          <form onSubmit={handlePay} className="lg:col-span-3 space-y-6">
            <section className="space-y-5">
              <h2 className="font-display text-lg tracking-wider text-foreground flex items-center gap-2">
                <CreditCard size={20} />
                Card Details
              </h2>
              <p className="text-xs text-muted-foreground font-body">(Simulated - no real charges)</p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="font-body text-xs uppercase tracking-widest text-muted-foreground">Cardholder Name</Label>
                  <Input
                    required
                    value={card.name}
                    onChange={(e) => setCard({ ...card, name: e.target.value })}
                    placeholder="John Doe"
                    className="rounded-sm font-body"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="font-body text-xs uppercase tracking-widest text-muted-foreground">Card Number</Label>
                  <Input
                    required
                    value={card.number}
                    onChange={(e) => setCard({ ...card, number: e.target.value.replace(/\D/g, "").slice(0, 16) })}
                    placeholder="4242 4242 4242 4242"
                    className="rounded-sm font-body"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-body text-xs uppercase tracking-widest text-muted-foreground">Expiry Date</Label>
                    <Input
                      required
                      value={card.expiry}
                      onChange={(e) => handleExpiryChange(e.target.value)}
                      placeholder="MM/YY"
                      maxLength={5}
                      className={`rounded-sm font-body ${expiryError ? "border-destructive" : ""}`}
                    />
                    {expiryError && (
                      <p className="text-xs text-destructive font-body">{expiryError}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body text-xs uppercase tracking-widest text-muted-foreground">CVV</Label>
                    <Input
                      required
                      value={card.cvv}
                      onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                      placeholder="123"
                      type="password"
                      className="rounded-sm font-body"
                    />
                  </div>
                </div>
              </div>
            </section>

            <div className="flex gap-4">
              <Button
                type="submit"
                disabled={paying || !!expiryError}
                className="flex-1 bg-foreground text-background hover:bg-foreground/90 font-body uppercase tracking-widest text-sm py-6 rounded-sm"
              >
                {paying ? "Processing..." : `Pay LKR ${order.total.toLocaleString()}`}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={cancelling}
                onClick={handleCancel}
                className="font-body uppercase tracking-widest text-sm py-6 rounded-sm"
              >
                {cancelling ? "Cancelling..." : "Cancel"}
              </Button>
            </div>
          </form>

          {/* Right - Order Summary */}
          <aside className="lg:col-span-2 space-y-6">
            <h2 className="font-display text-lg tracking-wider text-foreground">Order Summary</h2>
            <p className="font-body text-xs text-muted-foreground">Order: {order.orderId}</p>
            <div className="space-y-3">
              {order.items.map((item, i) => (
                <div key={i} className="flex justify-between font-body text-sm">
                  <span className="text-foreground">
                    {item.name} ({item.size}) x{item.quantity}
                  </span>
                  <span className="text-foreground">LKR {(item.unitPrice * item.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-2 font-body text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>LKR {order.subtotal.toLocaleString()}</span>
              </div>
              {(order.tierDiscount || 0) > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Loyalty Tier Discount ({order.loyaltyTierAtPurchase})</span>
                  <span>-LKR {(order.tierDiscount || 0).toLocaleString()}</span>
                </div>
              )}
              {(order.pointsDiscount || 0) > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Points Redemption ({order.redeemPointsApplied || 0} pts)</span>
                  <span>-LKR {(order.pointsDiscount || 0).toLocaleString()}</span>
                </div>
              )}
              {(order.couponDiscount || 0) > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Promo Code ({order.couponCode || "APPLIED"})</span>
                  <span>-LKR {(order.couponDiscount || 0).toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>Delivery</span>
                <span>{order.deliveryFee === 0 ? "Free" : `LKR ${order.deliveryFee}`}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-foreground font-display text-lg pt-2">
                <span>Total</span>
                <span>LKR {order.total.toLocaleString()}</span>
              </div>
            </div>

            {order.loyaltyPointsEarned > 0 && (
              <div className="bg-secondary/50 p-3 rounded-sm">
                <p className="font-body text-xs text-muted-foreground">
                  You'll earn <span className="text-foreground font-medium">{order.loyaltyPointsEarned} loyalty points</span> from this purchase
                </p>
                {doublePoints.active && (
                  <p className="font-body text-xs text-amber-600 dark:text-amber-400 mt-1">
                    Double Points is active{doublePoints.endsAt ? ` until ${new Date(doublePoints.endsAt).toLocaleString()}` : ""}
                  </p>
                )}
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
    </>
  );
}
