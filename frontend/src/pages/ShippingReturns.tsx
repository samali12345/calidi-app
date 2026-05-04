import { Truck, RotateCcw, Clock, Package } from "lucide-react";

export default function ShippingReturns() {
  return (
    <main className="min-h-screen bg-background">
      <section className="container mx-auto px-6 py-16 max-w-3xl">
        <h1 className="font-display text-4xl font-bold tracking-wider text-foreground mb-2">
          Shipping & Returns
        </h1>
        <p className="font-body text-muted-foreground mb-12">
          Everything you need to know about getting your order to you — and back to us if needed.
        </p>

        <div className="space-y-12">
          {/* Shipping */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Truck size={22} className="text-primary" />
              <h2 className="font-display text-2xl font-semibold text-foreground">Shipping</h2>
            </div>
            <div className="font-body text-sm text-muted-foreground leading-relaxed space-y-4 pl-9">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-lg border border-border p-4">
                  <p className="font-semibold text-foreground mb-1">Standard Shipping</p>
                  <p>5–7 business days</p>
                  <p className="text-foreground font-medium mt-1">Free over LKR 15,000</p>
                  <p>LKR 1,200 for orders under LKR 15,000</p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="font-semibold text-foreground mb-1">Express Shipping</p>
                  <p>2–3 business days</p>
                  <p className="text-foreground font-medium mt-1">LKR 2,500</p>
                </div>
              </div>
              <p>Orders placed before 2 PM on business days are processed the same day. You'll receive a tracking email once your order ships.</p>
              <p>We currently ship within Sri Lanka. International shipping is coming soon.</p>
            </div>
          </div>

          {/* Processing */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Clock size={22} className="text-primary" />
              <h2 className="font-display text-2xl font-semibold text-foreground">Processing Time</h2>
            </div>
            <div className="font-body text-sm text-muted-foreground leading-relaxed space-y-3 pl-9">
              <p>Most orders are processed within 1–2 business days. During sales or holiday periods, processing may take up to 3 business days.</p>
            </div>
          </div>

          {/* Returns */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <RotateCcw size={22} className="text-primary" />
              <h2 className="font-display text-2xl font-semibold text-foreground">Returns</h2>
            </div>
            <div className="font-body text-sm text-muted-foreground leading-relaxed space-y-3 pl-9">
              <p>We accept returns within <span className="text-foreground font-medium">30 days</span> of delivery. Items must be unworn, unwashed, and in their original packaging with all tags attached.</p>
              <p>To initiate a return, email us at <span className="text-foreground font-medium">returns@calidi.com</span> with your order number and reason for return. We'll send you a prepaid return label.</p>
              <p>Refunds are processed within 5–7 business days after we receive and inspect the returned item.</p>
            </div>
          </div>

          {/* Exchanges */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Package size={22} className="text-primary" />
              <h2 className="font-display text-2xl font-semibold text-foreground">Exchanges</h2>
            </div>
            <div className="font-body text-sm text-muted-foreground leading-relaxed space-y-3 pl-9">
              <p>Need a different size or color? We offer free exchanges on all full-price items. Simply follow the return process and note your preferred exchange item.</p>
              <p><span className="text-foreground font-medium">Final sale items</span> (marked on the product page) are not eligible for returns or exchanges.</p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
