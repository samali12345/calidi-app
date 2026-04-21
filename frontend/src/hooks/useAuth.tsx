import { useState, useEffect, createContext, useContext, ReactNode, useCallback } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { apiFetch } from "@/lib/api";
import { registerPushToken, unregisterPushToken } from "@/lib/pushNotifications";

interface AuthUser {
  id: string;
  email: string;
  name?: string;
  mobileNumber?: string;
  role: "customer" | "admin" | "rider";
  isRider?: boolean;
  riderApprovalStatus?: "none" | "pending" | "approved" | "rejected";
  isAvailable?: boolean;
  vehicleType?: "bike" | "threewheel" | "van";
  loyaltyTier: string;
  loyaltyPoints: number;
  totalOrders: number;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  signIn: (
    email: string,
    password: string
  ) => Promise<{
    error: Error | null;
    isRider?: boolean;
    riderApprovalStatus?: "none" | "pending" | "approved" | "rejected";
  }>;
  signUp: (
    email: string,
    password: string,
    confirmPassword: string,
    name: string,
    mobileNumber: string,
    registerAsRider: boolean
  ) => Promise<{
    error: Error | null;
    isRider?: boolean;
    riderApprovalStatus?: "none" | "pending" | "approved" | "rejected";
  }>;
  signOut: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (idToken: string): Promise<AuthUser | null> => {
    try {
      const data = await apiFetch<{
        user: AuthUser;
        isRider?: boolean;
        riderApprovalStatus?: "none" | "pending" | "approved" | "rejected";
      }>("/auth/me", {
        token: idToken,
      });
      const normalizedUser: AuthUser = {
        ...data.user,
        riderApprovalStatus:
          data.riderApprovalStatus ||
          data.user.riderApprovalStatus ||
          (data.user.role === "rider" ? "pending" : "none"),
        isRider:
          data.isRider ??
          (data.user.role === "rider" &&
            (data.riderApprovalStatus || data.user.riderApprovalStatus) ===
              "approved"),
      };
      setUser(normalizedUser);
      return normalizedUser;
    } catch (err) {
      console.error("Failed to fetch user profile:", err);
      return null;
    }
  };

  // Listen to Firebase auth state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        const idToken = await fbUser.getIdToken();
        setToken(idToken);
        await fetchUserProfile(idToken);
        void registerPushToken(idToken);
      } else {
        setUser(null);
        setToken(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const refreshUser = useCallback(async () => {
    if (token) await fetchUserProfile(token);
  }, [token]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      const cred = await signInWithEmailAndPassword(auth, email, password);
        const idToken = await cred.user.getIdToken();
        setToken(idToken);
        const profile = await fetchUserProfile(idToken);
        return {
          error: null,
          isRider: profile?.isRider === true,
          riderApprovalStatus: profile?.riderApprovalStatus || "none",
        };
    } catch (err: any) {
      // Map Firebase error codes to friendly messages
      const code = err?.code || "";
      let message = err.message;
      if (code === "auth/user-not-found" || code === "auth/wrong-password" || code === "auth/invalid-credential") {
        message = "Invalid email or password";
      } else if (code === "auth/too-many-requests") {
        message = "Too many failed attempts. Please try again later.";
      }
      return {
        error: new Error(message),
        isRider: false,
        riderApprovalStatus: "none",
      };
    }
  }, []);

  const signUp = useCallback(async (
    email: string,
    password: string,
    confirmPassword: string,
    name: string,
    mobileNumber: string,
    registerAsRider: boolean
  ) => {
    try {
      await apiFetch("/auth/validate-signup", {
        method: "POST",
        body: { email, password, confirmPassword, name, mobileNumber },
      });

      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const idToken = await cred.user.getIdToken();

      await apiFetch("/auth/profile", {
        method: "POST",
        token: idToken,
        body: { name, mobileNumber, registerAsRider },
      });

      setToken(idToken);
      const profile = await fetchUserProfile(idToken);
      return {
        error: null,
        isRider: profile?.isRider === true,
        riderApprovalStatus: profile?.riderApprovalStatus || "none",
      };
    } catch (err: any) {
      const code = err?.code || "";
      let message = err.message;
      if (code === "auth/email-already-in-use") {
        message = "Email already registered";
      } else if (code === "auth/weak-password") {
        message = "Password must be at least 6 characters";
      } else if (code === "auth/invalid-email") {
        message = "Invalid email address";
      }
      return {
        error: new Error(message),
        isRider: false,
        riderApprovalStatus: "none",
      };
    }
  }, []);

  const signOut = useCallback(async () => {
    if (token) {
      await unregisterPushToken(token);
    }
    await firebaseSignOut(auth);
    setUser(null);
    setToken(null);
  }, [token]);

  return (
    <AuthContext.Provider value={{ user, token, loading, signIn, signUp, signOut, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
