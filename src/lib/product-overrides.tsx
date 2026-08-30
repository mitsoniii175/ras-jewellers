import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { CATALOG, type Product } from "@/lib/catalog";

/**
 * Applies admin-managed commercial data (price, stock, purity, weight…) on top
 * of the static photo catalogue, in the browser.
 *
 * Until the fetch resolves the site behaves exactly as it did before Feature 10
 * — every piece is Price on Request — so a slow or failed request degrades to
 * the old, correct behaviour rather than to a broken page.
 *
 * These values are for DISPLAY ONLY. Checkout re-derives every price and stock
 * check on the server, so a tampered response changes what a shopper SEES but
 * never what they are charged or allowed to buy.
 */

type Override = {
  name?: string;
  price?: number;
  stock?: number;
  purity?: string;
  type?: string;
  collection?: string;
  metal?: string;
  weightGrams?: number;
  priceOnRequest?: boolean;
  bisHallmark?: string;
  description?: string;
};

type ProductsValue = { products: Product[]; loaded: boolean };

const ProductsContext = createContext<ProductsValue>({ products: CATALOG, loaded: false });

export function ProductsProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<Record<string, Override> | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/products", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!cancelled && data?.overrides) setOverrides(data.overrides as Record<string, Override>);
      })
      .catch(() => {
        // Keep the static catalogue; everything stays Price on Request.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const products = useMemo<Product[]>(() => {
    if (!overrides) return CATALOG;

    return CATALOG.map((product) => {
      const o = overrides[product.code];
      if (!o) return product;

      return {
        ...product,
        name: o.name?.trim() || product.name,
        price: o.price,
        stock: o.stock,
        purity: (o.purity as Product["purity"]) ?? product.purity,
        type: (o.type as Product["type"]) ?? product.type,
        collection: (o.collection as Product["collection"]) ?? product.collection,
        material: (o.metal as Product["material"]) ?? product.material,
        weightGrams: o.weightGrams ?? product.weightGrams,
        bisHallmark: o.bisHallmark ?? product.bisHallmark,
        priceOnRequest: o.priceOnRequest === true || o.price === undefined,
      };
    });
  }, [overrides]);

  const value = useMemo(() => ({ products, loaded: overrides !== null }), [products, overrides]);

  return <ProductsContext.Provider value={value}>{children}</ProductsContext.Provider>;
}

/** The catalogue with admin data applied. Falls back to the static list. */
export function useProducts(): Product[] {
  return useContext(ProductsContext).products;
}

export function useProductsLoaded(): boolean {
  return useContext(ProductsContext).loaded;
}
