// The authority on what an order actually costs.
//
// THE RULE: nothing the browser sends about money is trusted. The client posts
// only `{ productId, qty }` plus which address to ship to. Every price, every
// line total, the GST, the shipping and the grand total are looked up and
// recalculated here, on the server, from the catalogue. A tampered payload
// changes nothing except which pieces get validated.

import { isInStock } from "@/lib/catalog";
import { listProducts, type MergedProduct } from "./product-service";
import { calculateTotals } from "@/lib/pricing";
import type { Address, Order, OrderItem } from "./types";

export type RequestedLine = { productId: string; qty: number };

export type ValidationFailure = {
  code:
    | "empty"
    | "unknown_product"
    | "unpublished"
    | "out_of_stock"
    | "insufficient_stock"
    | "price_on_request"
    | "invalid_quantity";
  message: string;
  productId?: string;
};

export type ValidatedOrder = {
  items: OrderItem[];
  subtotal: number;
  gst: number;
  shipping: number;
  total: number;
};

const MAX_QTY_PER_LINE = 99;

/**
 * Re-derives the whole order from the catalogue and rejects anything that
 * cannot legitimately be sold right now.
 *
 * Returns either the priced order or the FIRST problem found, so the customer
 * gets one clear thing to fix rather than a wall of errors.
 */
export async function validateAndPriceOrder(
  requested: RequestedLine[],
): Promise<{ ok: true; order: ValidatedOrder } | { ok: false; failure: ValidationFailure }> {
  if (!Array.isArray(requested) || requested.length === 0) {
    return { ok: false, failure: { code: "empty", message: "Your bag is empty." } };
  }

  // Merged view: admin-managed price/stock wins over the static catalogue.
  // Unpublished and archived pieces are absent, so they cannot be ordered.
  const products = await listProducts();
  const byId = new Map<string, MergedProduct>(products.map((p) => [p.id, p]));
  const items: OrderItem[] = [];

  // Collapse duplicate lines so someone cannot slip past a stock check by
  // splitting one product across several entries.
  const collapsed = new Map<string, number>();
  for (const line of requested) {
    if (typeof line?.productId !== "string") {
      return {
        ok: false,
        failure: { code: "unknown_product", message: "That product no longer exists." },
      };
    }
    const qty = Number(line.qty);
    if (!Number.isFinite(qty) || qty < 1 || Math.floor(qty) !== qty || qty > MAX_QTY_PER_LINE) {
      return {
        ok: false,
        failure: {
          code: "invalid_quantity",
          message: "Please choose a valid quantity.",
          productId: line.productId,
        },
      };
    }
    collapsed.set(line.productId, (collapsed.get(line.productId) ?? 0) + qty);
  }

  for (const [productId, qty] of collapsed) {
    const product = byId.get(productId);

    // CATALOG already excludes unpublished pieces, so a miss covers both a
    // deleted product and an unpublished one.
    if (!product) {
      return {
        ok: false,
        failure: {
          code: "unknown_product",
          message: "One of the pieces in your bag is no longer available.",
          productId,
        },
      };
    }

    // A piece with no price cannot be charged for — it has to go through the
    // WhatsApp enquiry route instead.
    if (product.priceOnRequest || product.price === undefined) {
      return {
        ok: false,
        failure: {
          code: "price_on_request",
          message: `${product.name} is priced on request. Please enquire on WhatsApp for this product.`,
          productId,
        },
      };
    }

    if (!isInStock(product)) {
      return {
        ok: false,
        failure: {
          code: "out_of_stock",
          message: `${product.name} is out of stock.`,
          productId,
        },
      };
    }

    if (product.stock !== undefined && qty > product.stock) {
      return {
        ok: false,
        failure: {
          code: "insufficient_stock",
          message: `Only ${product.stock} of ${product.name} ${product.stock === 1 ? "is" : "are"} available.`,
          productId,
        },
      };
    }

    items.push({
      productId: product.id,
      name: product.name,
      code: product.code,
      image: product.image,
      qty,
      // The server's price wins, always.
      price: product.price,
      purity: product.purity,
      weightGrams: product.weightGrams,
    });
  }

  // Same maths as the cart, run again here so the two can never disagree.
  const totals = calculateTotals(
    items.map((i) => ({ price: i.price, qty: i.qty, priceOnRequest: false })),
  );

  return {
    ok: true,
    order: {
      items,
      subtotal: totals.subtotal,
      gst: totals.gst,
      shipping: totals.shipping,
      total: totals.total,
    },
  };
}

/** Human-readable, sortable order reference, e.g. RAS-260827-4F2A. */
export function newOrderId(): string {
  const now = new Date();
  const stamp =
    String(now.getFullYear()).slice(2) +
    String(now.getMonth() + 1).padStart(2, "0") +
    String(now.getDate()).padStart(2, "0");

  const bytes = new Uint8Array(2);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();

  return `RAS-${stamp}-${suffix}`;
}

export function buildOrder(input: {
  validated: ValidatedOrder;
  address: Address;
  paymentMethod: string;
  customerEmail?: string;
}): Order {
  const now = new Date().toISOString();
  return {
    id: newOrderId(),
    placedAt: now,
    status: "Order Placed",
    // Payment is confirmed separately, never at order-creation time.
    paymentStatus: "Pending",
    paymentMethod: input.paymentMethod,
    items: input.validated.items,
    subtotal: input.validated.subtotal,
    gst: input.validated.gst,
    shipping: input.validated.shipping,
    total: input.validated.total,
    address: input.address,
    customerEmail: input.customerEmail,
    tracking: {
      events: [{ status: "Order Placed", at: now, source: "internal" }],
    },
  };
}
