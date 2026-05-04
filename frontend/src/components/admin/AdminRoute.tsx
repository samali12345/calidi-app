import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function AdminRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <main className="min-h-[70vh] flex items-center justify-center">
        <p className="font-body text-muted-foreground">Loading...</p>
      </main>
    );
  }

  if (!user) return <Navigate to="/auth" />;
  if (user.role !== "admin") return <Navigate to="/" />;

  return <>{children}</>;
}
