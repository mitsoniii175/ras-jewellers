import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";

import { api } from "@/lib/api";
import { AUTH_CHANGED_EVENT, type Customer } from "@/lib/auth-store";
import { availableToAdd, isInStock, type Product } from "@/lib/catalog";
import { useProducts } from "@/lib/product-overrides";
import { calculateTotals, type OrderTotals } from "@/lib/pricing";

/**
 * The shopping bag.
 *
 * Only `{ productId, qty }` is stored. Everything else — name, photo, price,
 * purity, stock — is resolved from the catalogue at render time, so a bag saved
 * last week can never show a stale price or a piece that has since been
 * unpublished.
 *
 * Guests keep the bag in localStorage; signed-in customers get it saved to
 * their account, so it follows them between devices exactly like the wishlist.
 */

export type CartLine = { productId: string; qty: number };

/** A cart line joined to its live catalogue entry, ready to render. */
export type CartItem = {
  product: Product;
  qty: number;
  /** qty x price, or undefined when the piece is Price on Request. */
  lineTotal?: number;
  /** Set when the saved qty no longer fits the available stock. */
  stockWarning?: string;
};

type CartContextValue = {
  items: CartItem[];
  /** Lines whose product has vanished from the catalogue. */
  totals: OrderTotals;
  itemCount: number;
  addItem: (product: Product, qty?: number) => void;
  removeItem: (productId: string) => void;
  updateQty: (productId: string, qty: number) => void;
  clearCart: () => void;
  qtyOf: (productId: string) => number;
  /** False when any line is Price on Request or out of stock. */
  canCheckout: boolean;
  checkoutBlockedReason: string | null;
};

const CartContext = createContext<CartContextValue | undefined>(undefined);
const STORAGE_KEY = "ras_cart";

function readLocal(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (l): l is CartLine =>
          Boolean(l) && typeof l.productId === "string" && typeof l.qty === "number",
      )
      .map((l) => ({ productId: l.productId, qty: Math.max(1, Math.floor(l.qty)) }));
  } catch {
    return [];
  }
}

function writeLocal(lines: CartLine[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  } catch {
    // Private browsing / quota — the in-memory bag still works this visit.
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  // Prices and stock come from the merged catalogue, so a bag saved last week
  // always reflects what the admin has published today.
  const catalogue = useProducts();
  const [lines, setLines] = useState<CartLine[]>([]);
  const signedIn = useRef(false);
  const hydrated = useRef(false);

  // Guest bag first, so the header count is right before any network call.
  useEffect(() => {
    setLines(readLocal());
    hydrated.current = true;
  }, []);

  // Follow the auth store: merge the guest bag into the account on login,
  // and clear the local mirror on logout.
  useEffect(() => {
    async function onAuthChanged(event: Event) {
      const customer = (event as CustomEvent<Customer | null>).detail;

      if (!customer) {
        // Signed out: don't leave this customer's bag on a shared device.
        signedIn.current = false;
        setLines([]);
        writeLocal([]);
        return;
      }

      signedIn.current = true;
      try {
        const local = readLocal();
        const res = local.length
          ? await api<{ lines: CartLine[] }>("/api/account/cart", {
              method: "PUT",
              body: { lines: local, merge: true },
            })
          : await api<{ lines: CartLine[] }>("/api/account/cart");
        setLines(res.lines);
        writeLocal(res.lines);
      } catch {
        // Keep the local bag; the next change retries the sync.
      }
    }

    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
  }, []);

  const persist = useCallback((next: CartLine[]) => {
    writeLocal(next);
    if (!signedIn.current) return;
    api("/api/account/cart", { method: "PUT", body: { lines: next } }).catch(() => {});
  }, []);

  const commit = useCallback(
    (updater: (current: CartLine[]) => CartLine[]) => {
      setLines((current) => {
        const next = updater(current);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const qtyOf = useCallback(
    (productId: string) => lines.find((l) => l.productId === productId)?.qty ?? 0,
    [lines],
  );

  const addItem = useCallback(
    (product: Product, qty = 1) => {
      if (!isInStock(product)) {
        toast.error(`${product.name} is out of stock.`);
        return;
      }

      commit((current) => {
        const existing = current.find((l) => l.productId === product.id);
        const inCart = existing?.qty ?? 0;
        const room = availableToAdd(product, inCart);

        if (room <= 0) {
          toast.error(`Only ${product.stock} in stock — you already have ${inCart} in your bag.`);
          return current;
        }

        const adding = Math.min(qty, room);
        if (adding < qty) {
          toast.warning(`Only ${adding} more available — we've added what we can.`);
        } else {
          toast.success(`${product.name} added to your bag`);
        }

        return existing
          ? current.map((l) => (l.productId === product.id ? { ...l, qty: l.qty + adding } : l))
          : [...current, { productId: product.id, qty: adding }];
      });
    },
    [commit],
  );

  const updateQty = useCallback(
    (productId: string, qty: number) => {
      const product = catalogue.find((p) => p.id === productId);
      if (!product) return;

      if (qty < 1) {
        commit((current) => current.filter((l) => l.productId !== productId));
        return;
      }

      // Never let the requested quantity exceed what is actually on the shelf.
      if (product.stock !== undefined && qty > product.stock) {
        toast.error(`Only ${product.stock} available for ${product.name}.`);
        commit((current) =>
          current.map((l) => (l.productId === productId ? { ...l, qty: product.stock! } : l)),
        );
        return;
      }

      commit((current) => current.map((l) => (l.productId === productId ? { ...l, qty } : l)));
    },
    [commit, catalogue],
  );

  const removeItem = useCallback(
    (productId: string) => commit((current) => current.filter((l) => l.productId !== productId)),
    [commit],
  );

  const clearCart = useCallback(() => commit(() => []), [commit]);

  // Join the saved lines to the live catalogue. Products that no longer exist
  // are dropped rather than rendered as a broken row.
  const items = useMemo<CartItem[]>(() => {
    const byId = new Map(catalogue.map((p) => [p.id, p]));
    const out: CartItem[] = [];

    for (const line of lines) {
      const product = byId.get(line.productId);
      if (!product) continue;

      let stockWarning: string | undefined;
      if (!isInStock(product)) stockWarning = "Out of stock";
      else if (product.stock !== undefined && line.qty > product.stock) {
        stockWarning = `Only ${product.stock} left in stock`;
      }

      out.push({
        product,
        qty: line.qty,
        lineTotal:
          product.priceOnRequest || product.price === undefined
            ? undefined
            : product.price * line.qty,
        stockWarning,
      });
    }

    return out;
  }, [lines, catalogue]);

  const totals = useMemo(
    () =>
      calculateTotals(
        items.map((i) => ({
          price: i.product.price,
          qty: i.qty,
          priceOnRequest: i.product.priceOnRequest,
        })),
      ),
    [items],
  );

  const itemCount = items.reduce((sum, i) => sum + i.qty, 0);

  // Checkout is blocked whenever the bag contains something we can't charge for
  // or can't actually ship.
  const { canCheckout, checkoutBlockedReason } = useMemo(() => {
    if (items.length === 0) return { canCheckout: false, checkoutBlockedReason: null };

    const outOfStock = items.filter((i) => i.stockWarning);
    if (outOfStock.length > 0) {
      return {
        canCheckout: false,
        checkoutBlockedReason: "Please fix the stock issues above before continuing.",
      };
    }

    if (totals.priceOnRequestCount > 0) {
      return {
        canCheckout: false,
        checkoutBlockedReason:
          "Your bag contains pieces priced on request. Please enquire on WhatsApp for these — our team will confirm the price and complete your order.",
      };
    }

    return { canCheckout: true, checkoutBlockedReason: null };
  }, [items, totals.priceOnRequestCount]);

  return (
    <CartContext.Provider
      value={{
        items,
        totals,
        itemCount,
        addItem,
        removeItem,
        updateQty,
        clearCart,
        qtyOf,
        canCheckout,
        checkoutBlockedReason,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
