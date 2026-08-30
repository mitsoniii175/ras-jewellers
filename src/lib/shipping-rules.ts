// Shipping charge rules.
//
// These are BUSINESS rules, not courier quotes. RAS Jewellers has not published
// a shipping tariff, and the homepage already promises "Safe Home Delivery —
// insured shipping across India", so the configured rule is free insured
// delivery. That is a decision, not an invented number.
//
// To charge for shipping later, change SHIPPING_RULES below — every quoted
// total on the site, in checkout and on the server follows automatically,
// because calculateTotals() is the only thing that reads it.
//
// If you later want LIVE courier rates instead of a flat rule, Shiprocket's
// /courier/serviceability endpoint returns them; call it from the server and
// feed the result into `shippingFor` — the shape below is deliberately simple
// enough to swap.

export type ShippingRules = {
  /** Flat charge in rupees applied to every order below the threshold. */
  flatRate: number;
  /** Orders at or above this subtotal ship free. 0 = everything ships free. */
  freeAbove: number;
  /** Charge added for cash-on-delivery orders. */
  codSurcharge: number;
};

export const SHIPPING_RULES: ShippingRules = {
  flatRate: 0,
  freeAbove: 0,
  codSurcharge: 0,
};

/**
 * The shipping charge for a given order subtotal, in rupees.
 *
 * `freeAbove: 0` means "free shipping always" — the current configuration.
 */
export function shippingFor(subtotal: number, rules: ShippingRules = SHIPPING_RULES): number {
  if (subtotal <= 0) return 0;
  if (rules.freeAbove === 0) return 0;
  return subtotal >= rules.freeAbove ? 0 : rules.flatRate;
}

/**
 * Parcel weight for the courier, in KG.
 *
 * Jewellery is light and Shiprocket rejects a zero weight, so we use the sum of
 * recorded piece weights plus packaging, with a sensible floor. Where a piece
 * has no recorded weight we fall back to the per-item default rather than
 * treating it as weightless.
 */
export const PACKAGING_WEIGHT_KG = 0.15;
const DEFAULT_ITEM_WEIGHT_G = 25;
const MIN_PARCEL_WEIGHT_KG = 0.2;

export function parcelWeightKg(items: { weightGrams?: number; qty: number }[]): number {
  const grams = items.reduce(
    (sum, item) => sum + (item.weightGrams ?? DEFAULT_ITEM_WEIGHT_G) * item.qty,
    0,
  );
  return Math.max(MIN_PARCEL_WEIGHT_KG, Number((grams / 1000 + PACKAGING_WEIGHT_KG).toFixed(3)));
}
