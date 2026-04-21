import { useAuth } from "@/hooks/useAuth";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { User, Award, ShoppingBag, Star } from "lucide-react";
import LoyaltyBadge from "@/components/LoyaltyBadge";

export default function Profile() {
  const { user, loading } = useAuth();

  if (!loading && !user) return <Navigate to="/auth" />;
  if (loading) {
    return (
      <main className="min-h-[70vh] flex items-center justify-center">
        <p className="font-body text-muted-foreground">Loading...</p>
      </main>
    );
  }

  const tierProgress = () => {
    if (!user) return null;
    if (user.loyaltyTier === "gold") return null;
    const target = user.loyaltyTier === "silver" ? 15 : 5;
    const label = user.loyaltyTier === "silver" ? "Gold" : "Silver";
    const remaining = target - user.totalOrders;
    return { label, remaining, target, current: user.totalOrders };
  };

  const progress = tierProgress();

  return (
    <main className="min-h-[70vh] py-12 px-6">
      <div className="container mx-auto max-w-2xl">
        <h1 className="font-display text-3xl font-bold tracking-wider text-foreground mb-10">
          My Profile
        </h1>

        <div className="space-y-8">
          {/* User Info */}
          <section className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center">
                <User size={24} className="text-muted-foreground" />
              </div>
              <div>
                <p className="font-display text-lg text-foreground">{user?.email}</p>
                <p className="font-body text-xs text-muted-foreground uppercase tracking-wider">
                  {user?.role === "admin"
                    ? "Administrator"
                    : user?.role === "rider"
                    ? user?.riderApprovalStatus === "approved"
                      ? "Rider"
                      : user?.riderApprovalStatus === "pending"
                      ? "Rider (Pending)"
                      : "Rider (Rejected)"
                    : "Customer"}
                </p>
              </div>
            </div>
          </section>

          <Separator />

          {/* Loyalty Status */}
          <section className="space-y-4">
            <h2 className="font-display text-lg tracking-wider text-foreground flex items-center gap-2">
              <Award size={20} />
              Loyalty Status
            </h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-secondary/50 p-4 rounded-sm text-center">
                <LoyaltyBadge tier={user?.loyaltyTier || "none"} size="lg" />
                <p className="font-body text-xs text-muted-foreground mt-2">Current Tier</p>
              </div>
              <div className="bg-secondary/50 p-4 rounded-sm text-center">
                <p className="font-display text-2xl text-foreground">{user?.loyaltyPoints || 0}</p>
                <p className="font-body text-xs text-muted-foreground mt-1">Points</p>
              </div>
              <div className="bg-secondary/50 p-4 rounded-sm text-center">
                <p className="font-display text-2xl text-foreground">{user?.totalOrders || 0}</p>
                <p className="font-body text-xs text-muted-foreground mt-1">Orders</p>
              </div>
            </div>

            {progress && (
              <div className="bg-secondary/30 p-4 rounded-sm">
                <div className="flex justify-between font-body text-sm mb-2">
                  <span className="text-muted-foreground">Progress to {progress.label}</span>
                  <span className="text-foreground">{progress.current}/{progress.target} orders</span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all"
                    style={{ width: `${(progress.current / progress.target) * 100}%` }}
                  />
                </div>
                <p className="font-body text-xs text-muted-foreground mt-2">
                  {progress.remaining} more order{progress.remaining > 1 ? "s" : ""} to unlock {progress.label} tier
                </p>
              </div>
            )}

            <div className="font-body text-sm space-y-1">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Star size={14} className="text-gray-400" />
                <span>Standard: No discount</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Star size={14} className="text-gray-500" />
                <span>Silver (5+ orders): 10% discount</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Star size={14} className="text-amber-500" />
                <span>Gold (15+ orders): 15% discount</span>
              </div>
            </div>
          </section>

          <Separator />

          {/* Quick Links */}
          <section className="space-y-4">
            <h2 className="font-display text-lg tracking-wider text-foreground flex items-center gap-2">
              <ShoppingBag size={20} />
              Quick Links
            </h2>
            <div className="flex gap-4">
              <Button asChild variant="outline" className="rounded-sm font-body uppercase tracking-widest text-sm">
                <Link to="/orders">Order History</Link>
              </Button>
              <Button asChild variant="outline" className="rounded-sm font-body uppercase tracking-widest text-sm">
                <Link to="/shop">Continue Shopping</Link>
              </Button>
              {user?.role === "admin" && (
                <Button asChild className="rounded-sm font-body uppercase tracking-widest text-sm bg-foreground text-background">
                  <Link to="/admin">Admin Dashboard</Link>
                </Button>
              )}
              {user?.isRider && (
                <Button asChild className="rounded-sm font-body uppercase tracking-widest text-sm bg-foreground text-background">
                  <Link to="/rider/dashboard">Rider Dashboard</Link>
                </Button>
              )}
              {user?.role === "rider" && !user?.isRider && (
                <Button asChild variant="outline" className="rounded-sm font-body uppercase tracking-widest text-sm">
                  <Link to="/rider/application-status">Rider Application</Link>
                </Button>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
