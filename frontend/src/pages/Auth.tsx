import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

export default function Auth() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [mobileNumber, setMobileNumber] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registerAsRider, setRegisterAsRider] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { signIn, signUp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectTo = (location.state as { from?: string })?.from || "/";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    if (isSignUp) {
      const normalizedName = name.trim().replace(/\s+/g, " ");
      const normalizedMobile = mobileNumber.trim().replace(/[\s-]/g, "");

      if (normalizedName.length < 2 || normalizedName.length > 60) {
        toast.error("Name must be between 2 and 60 characters");
        setSubmitting(false);
        return;
      }

      if (!/^\+?\d{7,15}$/.test(normalizedMobile)) {
        toast.error("Invalid mobile number. Use 7 to 15 digits, optional leading +");
        setSubmitting(false);
        return;
      }

      if (password !== confirmPassword) {
        toast.error("Passwords do not match");
        setSubmitting(false);
        return;
      }

      const { error, isRider, riderApprovalStatus } = await signUp(
        email,
        password,
        confirmPassword,
        normalizedName,
        normalizedMobile,
        registerAsRider
      );
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Account created and signed in!");
        if (isRider) {
          navigate("/rider/dashboard", { replace: true });
        } else if (
          riderApprovalStatus === "pending" ||
          riderApprovalStatus === "rejected"
        ) {
          navigate("/rider/application-status", { replace: true });
        } else {
          navigate(redirectTo, { replace: true });
        }
      }
    } else {
      const { error, isRider, riderApprovalStatus } = await signIn(email, password);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Signed in successfully!");
        if (isRider) {
          navigate("/rider/dashboard", { replace: true });
        } else if (
          riderApprovalStatus === "pending" ||
          riderApprovalStatus === "rejected"
        ) {
          navigate("/rider/application-status", { replace: true });
        } else {
          navigate(redirectTo, { replace: true });
        }
      }
    }
    setSubmitting(false);
  };

  return (
    <main className="min-h-[70vh] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="font-display text-3xl font-bold tracking-wider text-foreground">
            {isSignUp ? "Create Account" : "Sign In"}
          </h1>
          <p className="mt-2 font-body text-muted-foreground">
            {isSignUp
              ? "Join Calidi to track your orders"
              : "Welcome back to Calidi"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {isSignUp && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name" className="font-body text-xs uppercase tracking-widest text-muted-foreground">
                  Name
                </Label>
                <Input
                  id="name"
                  type="text"
                  required
                  minLength={2}
                  maxLength={60}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-sm border-border font-body"
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobileNumber" className="font-body text-xs uppercase tracking-widest text-muted-foreground">
                  Mobile Number
                </Label>
                <Input
                  id="mobileNumber"
                  type="tel"
                  required
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value)}
                  className="rounded-sm border-border font-body"
                  placeholder="+94771234567"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={registerAsRider}
                  onChange={(e) => setRegisterAsRider(e.target.checked)}
                  className="rounded border-border"
                />
                <span className="font-body text-sm text-foreground">Register as Rider</span>
              </label>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="font-body text-xs uppercase tracking-widest text-muted-foreground">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-sm border-border font-body"
              placeholder="you@example.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="font-body text-xs uppercase tracking-widest text-muted-foreground">
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-sm border-border font-body pr-10"
                placeholder="********"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {isSignUp && (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="font-body text-xs uppercase tracking-widest text-muted-foreground">
                Confirm Password
              </Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="rounded-sm border-border font-body pr-10"
                  placeholder="********"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-foreground text-background hover:bg-foreground/90 font-body uppercase tracking-widest text-sm py-6 rounded-sm"
          >
            {submitting ? "Please wait..." : isSignUp ? "Create Account" : "Sign In"}
          </Button>
        </form>

        <p className="text-center font-body text-sm text-muted-foreground">
          {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setSubmitting(false);
              setConfirmPassword("");
              setShowPassword(false);
              setShowConfirmPassword(false);
              setRegisterAsRider(false);
            }}
            className="text-foreground underline underline-offset-4 hover:text-primary transition-colors"
          >
            {isSignUp ? "Sign In" : "Create one"}
          </button>
        </p>
      </div>
    </main>
  );
}
