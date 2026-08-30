import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { AccountApiError, api } from "@/lib/api";
import type { PublicAdmin, Permission } from "@/lib/server/admin-types";

/**
 * Admin session state for the dashboard UI.
 *
 * `allowed()` hides controls the signed-in admin cannot use. That is a courtesy
 * only — every one of these permissions is enforced again on the server for
 * each request, so a hidden button is not a security boundary.
 */

type AdminContextValue = {
  admin: PublicAdmin | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  allowed: (permission: Permission) => boolean;
  refresh: () => Promise<void>;
};

const AdminContext = createContext<AdminContextValue | undefined>(undefined);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<PublicAdmin | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api<{ admin: PublicAdmin | null }>("/api/admin/session");
      setAdmin(res.admin);
    } catch {
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api<{ admin: PublicAdmin }>("/api/admin/login", {
      method: "POST",
      body: { email, password },
    });
    setAdmin(res.admin);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api("/api/admin/session", { method: "DELETE" });
    } catch {
      // Clear locally regardless — the cookie is gone or already invalid.
    }
    setAdmin(null);
  }, []);

  const allowed = useCallback(
    (permission: Permission) => admin?.permissions.includes(permission) ?? false,
    [admin],
  );

  const value = useMemo(
    () => ({ admin, loading, login, logout, allowed, refresh }),
    [admin, loading, login, logout, allowed, refresh],
  );

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within an AdminProvider");
  return ctx;
}

export { AccountApiError as AdminApiError };
