import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";

/**
 * Customer session state.
 *
 * Authentication itself lives on the server (see src/routes/api/auth/**): this
 * provider only mirrors it. The session token is an HttpOnly cookie that this
 * code deliberately cannot read — `customer` is populated by asking
 * /api/auth/session who the browser currently is.
 */
export type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  createdAt: string;
};

export type SignupInput = {
  name: string;
  phone: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type AuthContextValue = {
  customer: Customer | null;
  /** True until the first session check finishes — guards against UI flicker. */
  loading: boolean;
  login: (email: string, password: string) => Promise<Customer>;
  signup: (input: SignupInput) => Promise<Customer>;
  logout: () => Promise<void>;
  /** Applies a profile update that the server has already accepted. */
  setCustomer: (customer: Customer) => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Fires after a successful login/signup so other stores (currently the
 * wishlist) can pull their server-side copy without this file needing to know
 * about them.
 */
export const AUTH_CHANGED_EVENT = "ras-auth-changed";

function announce(customer: Customer | null) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<Customer | null>(AUTH_CHANGED_EVENT, { detail: customer }));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [customer, setCustomerState] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  // Ask the server who we are, once, on the client.
  useEffect(() => {
    let cancelled = false;
    api<{ customer: Customer | null }>("/api/auth/session")
      .then((res) => {
        if (cancelled) return;
        setCustomerState(res.customer);
        announce(res.customer);
      })
      .catch(() => {
        // Signed out, offline, or the API is unreachable — either way we
        // simply stay logged out rather than blocking the site.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<{ customer: Customer }>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
    setCustomerState(res.customer);
    announce(res.customer);
    toast.success(`Welcome back, ${res.customer.name.split(" ")[0]}`);
    return res.customer;
  }, []);

  const signup = useCallback(async (input: SignupInput) => {
    const res = await api<{ customer: Customer }>("/api/auth/signup", {
      method: "POST",
      body: input,
    });
    setCustomerState(res.customer);
    announce(res.customer);
    toast.success(`Welcome to RAS Jewellers, ${res.customer.name.split(" ")[0]}`);
    return res.customer;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      // Clear locally even if the request failed, so the customer isn't left
      // looking logged in on a shared device.
      setCustomerState(null);
      announce(null);
    }
  }, []);

  const setCustomer = useCallback((next: Customer) => {
    setCustomerState(next);
    announce(next);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ customer, loading, login, signup, logout, setCustomer }),
    [customer, loading, login, signup, logout, setCustomer],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
