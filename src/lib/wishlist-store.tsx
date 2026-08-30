import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { AUTH_CHANGED_EVENT, type Customer } from "@/lib/auth-store";

/**
 * Wishlist that survives a change of device.
 *
 * - Signed out: kept in localStorage, so a guest doesn't lose their picks.
 * - Signed in:  kept on the account (see /api/account/wishlist), so the same
 *               list appears on a phone, a laptop, or after clearing cookies.
 * - At login:   the guest list is MERGED into the account rather than
 *               replacing it, so nothing a customer saved is silently lost.
 */

type WishlistContextValue = {
  ids: string[];
  has: (productId: string) => boolean;
  toggle: (productId: string, label?: string) => void;
  remove: (productId: string) => void;
  count: number;
  /** True while the account copy is being fetched. */
  loading: boolean;
};

const WishlistContext = createContext<WishlistContextValue | undefined>(undefined);
const STORAGE_KEY = "ras_wishlist";

function readLocal(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function writeLocal(ids: string[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Private browsing / quota — the in-memory list still works for this visit.
  }
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [ids, setIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const signedIn = useRef(false);
  const hydrated = useRef(false);

  // Guest list first, so the hearts are correct before any network call.
  useEffect(() => {
    setIds(readLocal());
    hydrated.current = true;
  }, []);

  // Follow the auth store: pull the account list on login, drop back to the
  // local one on logout.
  useEffect(() => {
    async function onAuthChanged(event: Event) {
      const customer = (event as CustomEvent<Customer | null>).detail;

      if (!customer) {
        // Logged out: drop the local mirror so the next visitor on a shared
        // device does not inherit this customer's saved pieces. Their list is
        // safe on the account and returns when they log back in.
        signedIn.current = false;
        setIds([]);
        writeLocal([]);
        return;
      }

      signedIn.current = true;
      setLoading(true);
      try {
        const local = readLocal();
        // merge:true unions the guest picks with whatever the account already
        // holds, and returns the combined list.
        const res = local.length
          ? await api<{ productIds: string[] }>("/api/account/wishlist", {
              method: "PUT",
              body: { productIds: local, merge: true },
            })
          : await api<{ productIds: string[] }>("/api/account/wishlist");

        setIds(res.productIds);
        writeLocal(res.productIds);
      } catch {
        // Keep whatever we have locally; the next change will retry the sync.
      } finally {
        setLoading(false);
      }
    }

    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
  }, []);

  const persist = useCallback((next: string[]) => {
    writeLocal(next);
    if (!signedIn.current) return;
    // Fire-and-forget: the local copy is already correct, so a failed sync
    // shouldn't interrupt the customer. It reconciles on next login.
    api("/api/account/wishlist", { method: "PUT", body: { productIds: next } }).catch(() => {});
  }, []);

  const toggle = useCallback(
    (productId: string, label?: string) => {
      setIds((current) => {
        const exists = current.includes(productId);
        const next = exists ? current.filter((id) => id !== productId) : [...current, productId];
        persist(next);
        if (label) {
          toast.success(
            exists ? `${label} removed from wishlist` : `${label} saved to your wishlist`,
          );
        }
        return next;
      });
    },
    [persist],
  );

  const remove = useCallback(
    (productId: string) => {
      setIds((current) => {
        const next = current.filter((id) => id !== productId);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const has = useCallback((productId: string) => ids.includes(productId), [ids]);

  return (
    <WishlistContext.Provider value={{ ids, has, toggle, remove, count: ids.length, loading }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used within a WishlistProvider");
  return ctx;
}
