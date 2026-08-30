// Order maths, in one place so the cart, the summary and (later) the server
// all agree on the same numbers.
//
// These are BUSINESS RULES, not invented figures — change them here and every
// total on the site follows.

import { shippingFor } from "@/lib/shipping-rules";

/**
 * GST on gold/silver jewellery in India is 3%. This is the statutory rate, not
 * an estimate. If your CA applies a different treatment (e.g. making charges
 * taxed separately at 5%), change it here.
 */
export const GST_RATE = 0.03;

// Shipping charges come from the configurable business rules in
// src/lib/shipping-rules.ts — change them there, not here.
export { shippingFor, SHIPPING_RULES } from "@/lib/shipping-rules";

export type OrderTotals = {
  subtotal: number;
  gst: number;
  shipping: number;
  total: number;
  /** Lines that carry no price and must be quoted over WhatsApp instead. */
  priceOnRequestCount: number;
};

export type PricedLine = {
  price?: number;
  qty: number;
  priceOnRequest: boolean;
};

/**
 * The single source of truth for order totals.
 *
 * "Price on Request" lines contribute nothing to the money — they are counted
 * separately so the UI can route them to an enquiry rather than to payment.
 */
export function calculateTotals(lines: PricedLine[]): OrderTotals {
  let subtotal = 0;
  let priceOnRequestCount = 0;

  for (const line of lines) {
    if (line.priceOnRequest || line.price === undefined) {
      priceOnRequestCount += line.qty;
      continue;
    }
    subtotal += line.price * line.qty;
  }

  // Round to paise at each step so the displayed lines always add up to the
  // displayed total.
  subtotal = round2(subtotal);
  const gst = round2(subtotal * GST_RATE);
  const shipping = round2(shippingFor(subtotal));

  return {
    subtotal,
    gst,
    shipping,
    total: round2(subtotal + gst + shipping),
    priceOnRequestCount,
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Indian-format rupee display, e.g. "₹ 1,48,500". */
export function formatMoney(value: number): string {
  return `₹ ${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}
