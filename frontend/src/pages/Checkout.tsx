import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Truck, Lock, Award, Clock, Package, Calendar } from "lucide-react";
import { Link } from "react-router-dom";
import LoyaltyBadge from "@/components/LoyaltyBadge";
import type { Order, DeliveryMethod } from "@/lib/types";

const timeSlots = [
  { id: "any", label: "Any Time", description: "Flexible delivery window" },
  { id: "morning", label: "Morning", description: "9:00 AM - 12:00 PM" },
  { id: "afternoon", label: "Afternoon", description: "12:00 PM - 5:00 PM" },
  { id: "evening", label: "Evening", description: "5:00 PM - 9:00 PM" },
];

export default function Checkout() {
  const { items, totalPrice, totalItems } = useCart();
  const { user, token, loading } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const [address, setAddress] = useState({
    fullName: "",
    street: "",
    city: "",
    state: "",
    zip: "",
    country: "",
  });

  // Delivery details
  const [recipientName, setRecipientName] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("standard");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTimeSlot, setScheduledTimeSlot] = useState("any");
  const [deliveryMethods, setDeliveryMethods] = useState<DeliveryMethod[]>([]);
  const [sameRecipient, setSameRecipient] = useState(true);

  // Fetch delivery methods when city changes
  useEffect(() => {
    const fetchMethods = async () => {
      try {
        const res = await fetch(
          `http://127.0.0.1:5000/api/deliveries/methods/available?city=${encodeURIComponent(address.city)}`
        );
        const data = await res.json();
        setDeliveryMethods(data);
        // Reset to standard if current method becomes unavailable
        const currentAvailable = data.find(
          (m: DeliveryMethod) => m.id === deliveryMethod && m.available
        );
        if (!currentAvailable) setDeliveryMethod("standard");
      } catch {
        setDeliveryMethods([
          { id: "standard", name: "Standard Delivery", description: "5-7 business days", fee: 350, available: true },
        ]);
      }
    };
    fetchMethods();
  }, [address.city]);

  // Sync recipient name with full name if same
  useEffect(() => {
    if (sameRecipient) setRecipientName(address.fullName);
  }, [sameRecipient, address.fullName]);

  // Calculate fees
  const selectedMethod = deliveryMethods.find((m) => m.id === deliveryMethod);
  const deliveryFee = selectedMethod
    ? deliveryMethod === "standard" && totalItems >= 5
      ? 0
      : selectedMethod.fee
    : totalItems >= 5
    ? 0
    : 350;

  // Calculate loyalty discount preview
  const loyaltyTier = user?.loyaltyTier || "none";
  const discountPercent = loyaltyTier === "gold" ? 15 : loyaltyTier === "silver" ? 10 : 0;
  const discountAmount = Math.round(totalPrice * (discountPercent / 100));
  const orderTotal = totalPrice - discountAmount + deliveryFee;

  // Min date for scheduling (tomorrow)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const minDate = tomorrow.toISOString().split("T")[0];

  if (!loading && items.length === 0) {
    return (
      <main className="min-h-[70vh] flex flex-col items-center justify-center px-6 py-16">
        <h1 className="font-display text-2xl text-foreground mb-4">Your bag is empty</h1>
        <Button asChild variant="outline" className="rounded-sm font-body uppercase tracking-widest text-sm">
          <Link to="/shop">Continue Shopping</Link>
        </Button>
      </main>
    );
  }

  if (!loading && !user) {
    return (
      <main className="min-h-[70vh] flex flex-col items-center justify-center px-6 py-16 space-y-6">
        <Lock size={40} className="text-muted-foreground" />
        <h1 className="font-display text-2xl text-foreground">Sign in to checkout</h1>
        <p className="font-body text-muted-foreground text-center max-w-sm">
          You need to sign in before completing your purchase.
        </p>
        <Button
          asChild
          className="bg-foreground text-background hover:bg-foreground/90 font-body uppercase tracking-widest text-sm py-6 px-10 rounded-sm"
        >
          <Link to="/auth" state={{ from: "/checkout" }}>Sign In</Link>
        </Button>
      </main>
    );
  }

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const orderItems = items.map((item) => ({
        productId: item.product.p_id,
        name: item.product.name,
        size: item.size,
        quantity: item.quantity,
        unitPrice: item.product.price,
      }));

      const data = await apiFetch<Order>("/orders", {
        method: "POST",
        token,
        body: {
          items: orderItems,
          shippingAddress: address,
          deliveryDetails: {
            recipientName: sameRecipient ? address.fullName : recipientName,
            contactNumber,
            deliveryNotes,
            deliveryMethod,
            scheduledDate: scheduledDate || null,
            scheduledTimeSlot,
          },
        },
      });

      toast.success("Order created! Complete payment within 15 minutes.");
      navigate(`/payment/${data.orderId}`);
    } catch (err: any) {
      toast.error(err.message || "Checkout failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-[70vh] py-12 px-6">
      <div className="container mx-auto max-w-4xl">
        <h1 className="font-display text-3xl font-bold tracking-wider text-foreground mb-10">
          Checkout
        </h1>

        <form onSubmit={handleCheckout} className="grid grid-cols-1 lg:grid-cols-5 gap-10">
          {/* Left — Address + Delivery */}
          <div className="lg:col-span-3 space-y-8">
            <section className="space-y-5">
              <h2 className="font-display text-lg tracking-wider text-foreground">Shipping Address</h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="font-body text-xs uppercase tracking-widest text-muted-foreground">Full Name</Label>
                  <Input required value={address.fullName} onChange={(e) => setAddress({ ...address, fullName: e.target.value })} className="rounded-sm font-body" />
                </div>
                <div className="space-y-2">
                  <Label className="font-body text-xs uppercase tracking-widest text-muted-foreground">Street Address</Label>
                  <Input required value={address.street} onChange={(e) => setAddress({ ...address, street: e.target.value })} className="rounded-sm font-body" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-body text-xs uppercase tracking-widest text-muted-foreground">City</Label>
                    <Input required value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} className="rounded-sm font-body" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body text-xs uppercase tracking-widest text-muted-foreground">State / Province</Label>
                    <Input required value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} className="rounded-sm font-body" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-body text-xs uppercase tracking-widest text-muted-foreground">ZIP / Postal Code</Label>
                    <Input required value={address.zip} onChange={(e) => setAddress({ ...address, zip: e.target.value })} className="rounded-sm font-body" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-body text-xs uppercase tracking-widest text-muted-foreground">Country</Label>
                    <Input required value={address.country} onChange={(e) => setAddress({ ...address, country: e.target.value })} className="rounded-sm font-body" />
                  </div>
                </div>
              </div>
            </section>

            <Separator />

            {/* Delivery Recipient Details */}
            <section className="space-y-5">
              <h2 className="font-display text-lg tracking-wider text-foreground flex items-center gap-2">
                <Package size={20} />
                Delivery Details
              </h2>

              <div className="space-y-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sameRecipient}
                    onChange={(e) => setSameRecipient(e.target.checked)}
                    className="rounded border-border"
                  />
                  <span className="font-body text-sm text-foreground">Same as shipping name</span>
                </label>

                {!sameRecipient && (
                  <div className="space-y-2">
                    <Label className="font-body text-xs uppercase tracking-widest text-muted-foreground">Recipient Name</Label>
                    <Input
                      required
                      value={recipientName}
                      onChange={(e) => setRecipientName(e.target.value)}
                      placeholder="Recipient's full name"
                      className="rounded-sm font-body"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label className="font-body text-xs uppercase tracking-widest text-muted-foreground">Contact Number</Label>
                  <Input
                    required
                    value={contactNumber}
                    onChange={(e) => setContactNumber(e.target.value)}
                    placeholder="+94 7X XXX XXXX"
                    className="rounded-sm font-body"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="font-body text-xs uppercase tracking-widest text-muted-foreground">Delivery Notes (Optional)</Label>
                  <textarea
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    placeholder="Gate code, landmark, special instructions..."
                    className="w-full min-h-[80px] rounded-sm border border-input bg-background px-3 py-2 text-sm font-body ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  />
                </div>
              </div>
            </section>

            <Separator />

            {/* Delivery Method */}
            <section className="space-y-4">
              <h2 className="font-display text-lg tracking-wider text-foreground flex items-center gap-2">
                <Truck size={20} />
                Delivery Method
              </h2>
              <div className="space-y-3">
                {deliveryMethods.map((method) => (
                  <label
                    key={method.id}
                    className={`flex items-center gap-4 border rounded-sm p-4 cursor-pointer transition-colors ${
                      deliveryMethod === method.id
                        ? "border-primary bg-secondary/50"
                        : method.available
                        ? "border-border hover:border-muted-foreground"
                        : "border-border opacity-50 cursor-not-allowed"
                    }`}
                  >
                    <input
                      type="radio"
                      name="deliveryMethod"
                      value={method.id}
                      checked={deliveryMethod === method.id}
                      onChange={() => method.available && setDeliveryMethod(method.id)}
                      disabled={!method.available}
                      className="accent-foreground"
                    />
                    <Truck size={20} className="text-foreground shrink-0" />
                    <div className="flex-1">
                      <p className="font-body text-sm font-medium text-foreground">{method.name}</p>
                      <p className="font-body text-xs text-muted-foreground">{method.description}</p>
                      {!method.available && (
                        <p className="font-body text-xs text-destructive mt-1">Not available for your location</p>
                      )}
                    </div>
                    <span className="font-body text-sm font-medium text-foreground">
                      {method.id === "standard" && totalItems >= 5
                        ? "Free"
                        : `LKR ${method.fee.toLocaleString()}`}
                    </span>
                  </label>
                ))}
                {deliveryMethods.length === 0 && (
                  <div className="border border-primary rounded-sm p-4 flex items-center gap-4 bg-secondary/50">
                    <Truck size={20} className="text-foreground shrink-0" />
                    <div className="flex-1">
                      <p className="font-body text-sm font-medium text-foreground">Standard Delivery</p>
                      <p className="font-body text-xs text-muted-foreground">5-7 business days</p>
                    </div>
                    <span className="font-body text-sm font-medium text-foreground">
                      {totalItems >= 5 ? "Free" : "LKR 350"}
                    </span>
                  </div>
                )}
              </div>
              {deliveryMethod === "standard" && totalItems < 5 && (
                <p className="font-body text-xs text-amber-600 dark:text-amber-400">
                  Add {5 - totalItems} more item{5 - totalItems > 1 ? "s" : ""} for free standard delivery!
                </p>
              )}
            </section>

            <Separator />

            {/* Delivery Time Slot Scheduling */}
            <section className="space-y-4">
              <h2 className="font-display text-lg tracking-wider text-foreground flex items-center gap-2">
                <Calendar size={20} />
                Delivery Schedule
              </h2>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="font-body text-xs uppercase tracking-widest text-muted-foreground">
                    Preferred Delivery Date (Optional)
                  </Label>
                  <Input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={minDate}
                    className="rounded-sm font-body"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="font-body text-xs uppercase tracking-widest text-muted-foreground">
                    Preferred Time Slot
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    {timeSlots.map((slot) => (
                      <button
                        key={slot.id}
                        type="button"
                        onClick={() => setScheduledTimeSlot(slot.id)}
                        className={`flex items-center gap-2 border rounded-sm p-3 transition-colors text-left ${
                          scheduledTimeSlot === slot.id
                            ? "border-primary bg-secondary/50"
                            : "border-border hover:border-muted-foreground"
                        }`}
                      >
                        <Clock size={14} className="text-muted-foreground shrink-0" />
                        <div>
                          <p className="font-body text-sm font-medium text-foreground">{slot.label}</p>
                          <p className="font-body text-xs text-muted-foreground">{slot.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Right — Order Summary */}
          <aside className="lg:col-span-2 space-y-6">
            <h2 className="font-display text-lg tracking-wider text-foreground">Order Summary</h2>

            {/* Loyalty Discount Banner */}
            {discountPercent > 0 && (
              <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-sm p-3 flex items-center gap-2">
                <Award size={16} className="text-green-600 dark:text-green-400" />
                <div>
                  <p className="font-body text-sm text-green-700 dark:text-green-400 font-medium">
                    <LoyaltyBadge tier={loyaltyTier} size="sm" /> {discountPercent}% discount applied!
                  </p>
                  <p className="font-body text-xs text-green-600 dark:text-green-500">
                    You save LKR {discountAmount.toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {items.map((item) => (
                <div key={`${item.product.id}-${item.size}`} className="flex gap-3">
                  <img src={item.product.image} alt={item.product.name} className="w-14 h-18 object-cover rounded-sm bg-secondary" />
                  <div className="flex-1">
                    <p className="font-body text-sm text-foreground">{item.product.name}</p>
                    <p className="font-body text-xs text-muted-foreground">Size: {item.size} · Qty: {item.quantity}</p>
                  </div>
                  <span className="font-body text-sm text-foreground">LKR {(item.product.price * item.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-2 font-body text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal ({totalItems} item{totalItems > 1 ? "s" : ""})</span>
                <span>LKR {totalPrice.toLocaleString()}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Loyalty Discount ({discountPercent}%)</span>
                  <span>-LKR {discountAmount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>Delivery ({selectedMethod?.name || "Standard"})</span>
                <span>{deliveryFee === 0 ? "Free" : `LKR ${deliveryFee.toLocaleString()}`}</span>
              </div>
              <Separator />
              <div className="flex justify-between text-foreground font-display text-lg pt-2">
                <span>Total</span>
                <span>LKR {orderTotal.toLocaleString()}</span>
              </div>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full bg-foreground text-background hover:bg-foreground/90 font-body uppercase tracking-widest text-sm py-6 rounded-sm"
            >
              {submitting ? "Creating Order..." : "Proceed to Payment"}
            </Button>

            <p className="font-body text-xs text-muted-foreground text-center">
              You'll have 15 minutes to complete the payment
            </p>
          </aside>
        </form>
      </div>
    </main>
  );
}
