import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import { useAuth } from "@/hooks/useAuth";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { CheckCircle, FileText, Award, Download, Truck } from "lucide-react";
import LoyaltyBadge from "@/components/LoyaltyBadge";
import type { Order } from "@/lib/types";
import jsPDF from "jspdf";

export default function PaymentSuccess() {
  const { clearCart } = useCart();
  const { token, refreshUser } = useAuth();
  const { orderId } = useParams<{ orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [invoice, setInvoice] = useState<any>(null);
  const [showInvoice, setShowInvoice] = useState(false);

  useEffect(() => {
    clearCart();
    refreshUser();
  }, [clearCart, refreshUser]);

  useEffect(() => {
    if (!orderId || !token) return;
    apiFetch<Order>(`/orders/${orderId}`, { token }).then(setOrder).catch(() => {});
  }, [orderId, token]);

  const handleViewInvoice = async () => {
    if (!orderId || !token) return;
    try {
      const data = await apiFetch(`/orders/${orderId}/invoice`, { token });
      setInvoice(data);
      setShowInvoice(true);
    } catch {
      // ignore
    }
  };

  const handleDownloadPDF = () => {
    if (!invoice || !order) return;

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    let y = 20;

    // Header
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("CALIDI", pageWidth / 2, y, { align: "center" });
    y += 8;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Women's Fashion", pageWidth / 2, y, { align: "center" });
    y += 15;

    // Invoice title
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("INVOICE", 20, y);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(invoice.invoiceNumber, pageWidth - 20, y, { align: "right" });
    y += 10;

    // Line
    doc.setDrawColor(200);
    doc.line(20, y, pageWidth - 20, y);
    y += 10;

    // Customer details
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Bill To:", 20, y);
    doc.setFont("helvetica", "normal");
    y += 6;
    doc.text(invoice.customer.fullName, 20, y);
    y += 5;
    doc.text(`${invoice.customer.street}, ${invoice.customer.city}`, 20, y);
    y += 5;
    doc.text(`${invoice.customer.state}, ${invoice.customer.zip}, ${invoice.customer.country}`, 20, y);
    y += 5;
    doc.text(invoice.customer.email, 20, y);
    y += 5;

    // Order date
    doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, pageWidth - 20, y - 15, { align: "right" });
    doc.text(`Order: ${order.orderId}`, pageWidth - 20, y - 10, { align: "right" });
    y += 10;

    // Line
    doc.line(20, y, pageWidth - 20, y);
    y += 10;

    // Table header
    doc.setFont("helvetica", "bold");
    doc.text("Item", 20, y);
    doc.text("Size", 100, y);
    doc.text("Qty", 125, y);
    doc.text("Unit Price", 145, y);
    doc.text("Total", pageWidth - 20, y, { align: "right" });
    y += 3;
    doc.line(20, y, pageWidth - 20, y);
    y += 7;

    // Items
    doc.setFont("helvetica", "normal");
    invoice.order.items.forEach((item: any) => {
      const itemTotal = item.unitPrice * item.quantity;
      doc.text(item.name.substring(0, 40), 20, y);
      doc.text(item.size, 100, y);
      doc.text(String(item.quantity), 125, y);
      doc.text(`LKR ${item.unitPrice.toLocaleString()}`, 145, y);
      doc.text(`LKR ${itemTotal.toLocaleString()}`, pageWidth - 20, y, { align: "right" });
      y += 7;
    });

    y += 3;
    doc.line(20, y, pageWidth - 20, y);
    y += 10;

    // Totals
    const rightCol = pageWidth - 20;
    doc.text("Subtotal:", rightCol - 50, y);
    doc.text(`LKR ${invoice.order.subtotal.toLocaleString()}`, rightCol, y, { align: "right" });
    y += 6;

    if (invoice.order.discount > 0) {
      doc.setTextColor(34, 139, 34);
      doc.text(`Loyalty Discount (${invoice.order.loyaltyTierAtPurchase}):`, rightCol - 50, y);
      doc.text(`-LKR ${invoice.order.discount.toLocaleString()}`, rightCol, y, { align: "right" });
      doc.setTextColor(0);
      y += 6;
    }

    doc.text("Delivery:", rightCol - 50, y);
    doc.text(invoice.order.deliveryFee === 0 ? "Free" : `LKR ${invoice.order.deliveryFee}`, rightCol, y, { align: "right" });
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Total Paid:", rightCol - 50, y);
    doc.text(`LKR ${invoice.order.total.toLocaleString()}`, rightCol, y, { align: "right" });
    y += 15;

    // Loyalty points
    if (order.loyaltyPointsEarned > 0) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Loyalty Points Earned: +${order.loyaltyPointsEarned}`, 20, y);
      y += 10;
    }

    // Footer
    doc.setFontSize(9);
    doc.setTextColor(128);
    doc.text("Thank you for shopping with Calidi!", pageWidth / 2, y + 10, { align: "center" });
    doc.text(invoice.company.name, pageWidth / 2, y + 16, { align: "center" });

    doc.save(`Calidi_Invoice_${order.orderId}.pdf`);
  };

  return (
    <main className="min-h-[70vh] flex flex-col items-center justify-center px-6 py-16">
      <div className="max-w-lg w-full text-center space-y-6">
        <CheckCircle size={56} className="text-green-500 mx-auto" />
        <h1 className="font-display text-3xl font-bold tracking-wider text-foreground">
          Thank You!
        </h1>
        <p className="font-body text-muted-foreground">
          Your order has been placed successfully.
        </p>

        {order && (
          <div className="bg-secondary/30 rounded-sm p-6 text-left space-y-4">
            <div className="flex justify-between items-center">
              <span className="font-body text-sm text-muted-foreground">Order ID</span>
              <span className="font-display text-sm text-foreground">{order.orderId}</span>
            </div>
            <Separator />
            <div className="space-y-2">
              {order.items.map((item, i) => (
                <div key={i} className="flex justify-between font-body text-sm">
                  <span className="text-muted-foreground">{item.name} ({item.size}) x{item.quantity}</span>
                  <span className="text-foreground">LKR {(item.unitPrice * item.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <Separator />
            <div className="space-y-1 font-body text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>LKR {order.subtotal.toLocaleString()}</span>
              </div>
              {order.discount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Loyalty Discount</span>
                  <span>-LKR {order.discount.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>Delivery</span>
                <span>{order.deliveryFee === 0 ? "Free" : `LKR ${order.deliveryFee}`}</span>
              </div>
              <div className="flex justify-between text-foreground font-medium pt-1 border-t border-border">
                <span>Total Paid</span>
                <span>LKR {order.total.toLocaleString()}</span>
              </div>
            </div>

            {order.loyaltyPointsEarned > 0 && (
              <>
                <Separator />
                <div className="flex items-center gap-2">
                  <Award size={16} className="text-amber-500" />
                  <span className="font-body text-sm text-foreground">
                    +{order.loyaltyPointsEarned} loyalty points earned
                  </span>
                  {order.loyaltyTierAtPurchase !== "none" && (
                    <LoyaltyBadge tier={order.loyaltyTierAtPurchase} size="sm" />
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Invoice Section */}
        {showInvoice && invoice && (
          <div className="bg-white dark:bg-gray-900 border border-border rounded-sm p-6 text-left space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-display text-lg text-foreground">Invoice</h3>
              <span className="font-body text-xs text-muted-foreground">{invoice.invoiceNumber}</span>
            </div>
            <Separator />
            <div className="font-body text-sm space-y-1 text-muted-foreground">
              <p><strong className="text-foreground">Bill To:</strong> {invoice.customer.fullName}</p>
              <p>{invoice.customer.street}, {invoice.customer.city}</p>
              <p>{invoice.customer.state}, {invoice.customer.zip}, {invoice.customer.country}</p>
              <p>{invoice.customer.email}</p>
            </div>
            <Separator />
            <div className="font-body text-sm space-y-1">
              {invoice.order.items.map((item: any, i: number) => (
                <div key={i} className="flex justify-between">
                  <span className="text-muted-foreground">{item.name} ({item.size}) x{item.quantity}</span>
                  <span className="text-foreground">LKR {(item.unitPrice * item.quantity).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <Separator />
            <div className="font-body text-sm font-medium flex justify-between text-foreground">
              <span>Total</span>
              <span>LKR {invoice.order.total.toLocaleString()}</span>
            </div>
            <p className="font-body text-xs text-muted-foreground text-center">{invoice.company.name}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-4 justify-center">
          {order && order.deliveryId && (
            <Button
              asChild
              variant="outline"
              className="rounded-sm font-body uppercase tracking-widest text-sm"
            >
              <Link to={`/delivery/${order.deliveryId}`}>
                <Truck size={16} className="mr-2" />
                Track Delivery
              </Link>
            </Button>
          )}
          {order && !showInvoice && (
            <Button
              onClick={handleViewInvoice}
              variant="outline"
              className="rounded-sm font-body uppercase tracking-widest text-sm"
            >
              <FileText size={16} className="mr-2" />
              View Invoice
            </Button>
          )}
          {showInvoice && invoice && (
            <Button
              onClick={handleDownloadPDF}
              variant="outline"
              className="rounded-sm font-body uppercase tracking-widest text-sm"
            >
              <Download size={16} className="mr-2" />
              Download PDF
            </Button>
          )}
          <Button
            asChild
            className="bg-foreground text-background hover:bg-foreground/90 font-body uppercase tracking-widest text-sm py-6 px-10 rounded-sm"
          >
            <Link to="/shop">Continue Shopping</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="rounded-sm font-body uppercase tracking-widest text-sm"
          >
            <Link to="/orders">View Orders</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
