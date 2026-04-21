import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { apiFetch } from "@/lib/api";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("No verification token provided.");
      return;
    }

    apiFetch<{ message: string }>(`/auth/verify-email?token=${token}`)
      .then((data) => {
        setStatus("success");
        setMessage(data.message);
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err.message);
      });
  }, [token]);

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-6 py-16">
      <div className="text-center space-y-6 max-w-md">
        {status === "loading" && (
          <>
            <Loader2 size={48} className="mx-auto animate-spin text-muted-foreground" />
            <p className="font-body text-muted-foreground">Verifying your email…</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle size={48} className="mx-auto text-green-600" />
            <h1 className="font-display text-2xl font-bold tracking-wider text-foreground">Email Verified!</h1>
            <p className="font-body text-muted-foreground">{message}</p>
            <Button asChild className="bg-foreground text-background hover:bg-foreground/90 font-body uppercase tracking-widest text-sm py-6 px-10 rounded-sm">
              <Link to="/auth">Sign In</Link>
            </Button>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle size={48} className="mx-auto text-destructive" />
            <h1 className="font-display text-2xl font-bold tracking-wider text-foreground">Verification Failed</h1>
            <p className="font-body text-muted-foreground">{message}</p>
            <Button asChild variant="outline" className="rounded-sm font-body uppercase tracking-widest text-sm">
              <Link to="/auth">Back to Sign In</Link>
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
