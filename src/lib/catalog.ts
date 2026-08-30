// This catalog is built automatically from every image inside
// src/assets/products/catalog/<category-slug>/*.jpg — drop new photos into
// the matching category folder (or add a new folder + entry in
// CATEGORY_META below) and they'll show up on the site with no further
// code changes needed. No prices are stored anywhere — this business
// quotes prices over WhatsApp / in-store instead of listing them online.

import {
  PRODUCT_ATTRIBUTES,
  TYPE_BY_CATEGORY,
  type Collection,
  type JewelleryType,
  type Purity,
} from "@/lib/product-attributes";

export type { Purity, JewelleryType, Collection };

export type Material = "gold" | "silver" | "diamond";

export type CategorySlug =
  | "gold-jewellery"
  | "mens-jewellery"
  | "silver-jewellery"
  | "womens-bangles"
  | "womens-earrings"
  | "womens-necklace"
  | "womens-payal";

export type Product = {
  id: string;
  name: string;
  /** SKU. */
  code: string;
  image: string;
  material: Material;
  category: CategorySlug;
  /** Human label for the category, e.g. "Women's Necklaces". */
  categoryLabel: string;

  // --- Commercial attributes (from src/lib/product-attributes.ts) ---------
  // All optional: unknown stays unknown rather than being guessed at.
  price?: number;
  makingChargesPct?: number;
  weightGrams?: number;
  purity?: Purity;
  type?: JewelleryType;
  collection?: Collection;
  /** `undefined` = stock not tracked yet; a number = enforced. */
  stock?: number;
  /** True whenever there is no price to charge. Drives the WhatsApp enquiry path. */
  priceOnRequest: boolean;
  bisHallmark?: string;
};

/** In stock unless stock is tracked AND has run out. */
export function isInStock(product: Product): boolean {
  return product.stock === undefined || product.stock > 0;
}

/** How many more units may be added, given what is already in the bag. */
export function availableToAdd(product: Product, alreadyInCart: number): number {
  if (product.stock === undefined) return Number.POSITIVE_INFINITY;
  return Math.max(0, product.stock - alreadyInCart);
}

const CATEGORY_META: Record<
  CategorySlug,
  { label: string; material: Material; codePrefix: string }
> = {
  "gold-jewellery": { label: "Gold Jewellery", material: "gold", codePrefix: "GLD" },
  "mens-jewellery": { label: "Men's Jewellery", material: "gold", codePrefix: "MEN" },
  "silver-jewellery": { label: "Silver Jewellery", material: "silver", codePrefix: "SLV" },
  "womens-bangles": { label: "Women's Bangles", material: "gold", codePrefix: "BNG" },
  "womens-earrings": { label: "Women's Earrings", material: "gold", codePrefix: "EAR" },
  "womens-necklace": { label: "Women's Necklaces", material: "gold", codePrefix: "NCK" },
  "womens-payal": { label: "Women's Payal", material: "silver", codePrefix: "PYL" },
};

const modules = import.meta.glob("/src/assets/products/catalog/**/*.jpg", {
  eager: true,
  import: "default",
}) as Record<string, string>;

function buildCatalog(): Product[] {
  const products: Product[] = [];
  const entries = Object.entries(modules).sort(([a], [b]) => a.localeCompare(b));

  for (const [path, url] of entries) {
    const match = path.match(/catalog\/([a-z-]+)\/(\d+)\.jpg$/);
    if (!match) continue;
    const [, slug, num] = match;
    const meta = CATEGORY_META[slug as CategorySlug];
    if (!meta) continue;

    const code = `${meta.codePrefix}-${num}`;
    const attrs = PRODUCT_ATTRIBUTES[code] ?? {};

    // Unpublished pieces never reach the storefront.
    if (attrs.published === false) continue;

    products.push({
      id: `${slug}-${num}`,
      name: `${meta.label} — Design ${num}`,
      code,
      image: url,
      material: meta.material,
      category: slug as CategorySlug,
      categoryLabel: meta.label,

      price: attrs.price,
      makingChargesPct: attrs.makingChargesPct,
      weightGrams: attrs.weightGrams,
      purity: attrs.purity,
      // Fall back to the type implied by the folder, where the folder says so.
      type: attrs.type ?? TYPE_BY_CATEGORY[slug],
      collection: attrs.collection,
      stock: attrs.stock,
      // No price recorded => price on request. This is the default for the
      // whole catalogue today, and matches how the showroom actually quotes.
      priceOnRequest: attrs.priceOnRequest === true || attrs.price === undefined,
      bisHallmark: attrs.bisHallmark,
    });
  }

  return products;
}

export const CATALOG: Product[] = buildCatalog();

export const CATALOG_CATEGORIES: {
  slug: CategorySlug;
  label: string;
  count: number;
  image: string;
}[] = (Object.keys(CATEGORY_META) as CategorySlug[])
  .map((slug) => {
    const items = CATALOG.filter((p) => p.category === slug);
    return {
      slug,
      label: CATEGORY_META[slug].label,
      count: items.length,
      image: items[0]?.image ?? "",
    };
  })
  .filter((c) => c.count > 0);
