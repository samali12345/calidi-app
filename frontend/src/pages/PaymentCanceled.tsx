import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

export default function PaymentCanceled() {
  return (
    <main className="min-h-[70vh] flex flex-col items-center justify-center px-6 py-16 text-center space-y-6">
      <XCircle size={56} className="text-destructive" />
      <h1 className="font-display text-3xl font-bold tracking-wider text-foreground">
        Payment Canceled
      </h1>
      <p className="font-body text-muted-foreground max-w-md">
        Your payment was not completed. Your bag items are still saved.
      </p>
      <Button
        asChild
        className="bg-foreground text-background hover:bg-foreground/90 font-body uppercase tracking-widest text-sm py-6 px-10 rounded-sm"
      >
        <Link to="/checkout">Return to Checkout</Link>
      </Button>
    </main>
  );
}
