// Commercial attributes for the photo catalogue.
//
// WHY THIS FILE EXISTS
// --------------------
// src/lib/catalog.ts builds 353 products out of the image filenames in
// src/assets/products/catalog/**. That gives us a name, a SKU, a photo, a
// category and a metal — and nothing else. Price, stock, weight, purity and
// collection have never existed in this project.
//
// Search, filters, the cart and (later) checkout all need those fields, so
// this file is where they live. It is deliberately EMPTY to start with:
// inventing prices or stock levels for real jewellery would be worse than
// having none. Every product therefore stays "Price on Request", which is
// exactly how this business already operates.
//
// HOW TO FILL IT IN
// -----------------
// Key each entry by SKU (the `code` field — e.g. "NCK-001"). Add only what you
// know; every field is optional and anything you leave out simply stays
// unknown rather than being guessed at.
//
//   export const PRODUCT_ATTRIBUTES: Record<string, ProductAttributes> = {
//     "NCK-001": {
//       price: 148500,        // rupees, the all-in selling price
//       weightGrams: 24.6,
//       purity: "22K",
//       type: "Necklace",
//       collection: "Bridal",
//       stock: 2,
//       bisHallmark: "HUID AZ1234",
//     },
//   };
//
// Setting `price` is what turns a product into a normally purchasable item.
// Without it the product keeps its "Price on Request" behaviour and routes the
// customer to WhatsApp instead of to checkout.
//
// The Admin Dashboard (Feature 10) will read and write these same fields from
// the database, at which point this file becomes the seed/fallback rather than
// the source of truth.

/** Metal purity. Only values that actually appear in the data are offered as filters. */
export type Purity = "24K" | "22K" | "18K" | "14K" | "925 Silver";

/** What the piece physically is. Independent of which folder the photo sits in. */
export type JewelleryType =
  | "Ring"
  | "Necklace"
  | "Mangalsutra"
  | "Bangle"
  | "Bracelet"
  | "Earrings"
  | "Chain"
  | "Pendant"
  | "Payal"
  | "Set";

export type Collection =
  "Bridal" | "Wedding" | "Daily Wear" | "Antique" | "Festive" | "Office Wear";

export type ProductAttributes = {
  /** All-in selling price in rupees. Omit to keep the piece "Price on Request". */
  price?: number;
  /** Making charges as a percentage of the metal value, if you itemise them. */
  makingChargesPct?: number;
  weightGrams?: number;
  purity?: Purity;
  type?: JewelleryType;
  collection?: Collection;
  /** Units in stock. `undefined` means stock is not tracked for this piece yet. */
  stock?: number;
  /** Force "Price on Request" even when a price is present (e.g. bespoke work). */
  priceOnRequest?: boolean;
  /** Hidden from the storefront when false. */
  published?: boolean;
  /** BIS / HUID certification reference shown on the product. */
  bisHallmark?: string;
};

/**
 * Real commercial data, keyed by SKU. Empty until the showroom fills it in or
 * the admin dashboard starts writing to it.
 */
export const PRODUCT_ATTRIBUTES: Record<string, ProductAttributes> = {};

/**
 * Jewellery type inferred from the category folder — but ONLY where the folder
 * name literally states the type. "gold-jewellery", "silver-jewellery" and
 * "mens-jewellery" describe a metal or an audience, not a form, so pieces in
 * those folders keep an unknown type until someone records it above.
 */
export const TYPE_BY_CATEGORY: Partial<Record<string, JewelleryType>> = {
  "womens-necklace": "Necklace",
  "womens-earrings": "Earrings",
  "womens-bangles": "Bangle",
  "womens-payal": "Payal",
};
