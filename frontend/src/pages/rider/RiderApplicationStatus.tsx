import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Clock, XCircle } from "lucide-react";

export default function RiderApplicationStatus() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main className="min-h-[70vh] flex items-center justify-center">
        <p className="font-body text-muted-foreground">Loading...</p>
      </main>
    );
  }

  if (!user) return <Navigate to="/auth" />;

  if (user.isRider) return <Navigate to="/rider/dashboard" />;

  const isRejected = user.riderApprovalStatus === "rejected";
  const isPending = user.riderApprovalStatus === "pending";

  if (!isRejected && !isPending) return <Navigate to="/" />;

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg border border-border rounded-sm p-8 space-y-4 text-center">
        {isRejected ? (
          <XCircle size={44} className="mx-auto text-red-600" />
        ) : (
          <Clock size={44} className="mx-auto text-amber-600" />
        )}
        <h1 className="font-display text-2xl font-bold tracking-wider text-foreground">
          {isRejected ? "Rider Application Rejected" : "Rider Application Pending"}
        </h1>
        <p className="font-body text-sm text-muted-foreground">
          {isRejected
            ? "Your rider request was reviewed and rejected. You can continue using the customer app."
            : "Your rider request was submitted successfully. Admin approval is required before dashboard access."}
        </p>
        <div className="flex justify-center gap-3">
          <Button asChild variant="outline" className="rounded-sm font-body text-xs uppercase tracking-widest">
            <Link to="/profile">Go to Profile</Link>
          </Button>
          <Button asChild className="rounded-sm font-body text-xs uppercase tracking-widest bg-foreground text-background">
            <Link to="/">Go Home</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
