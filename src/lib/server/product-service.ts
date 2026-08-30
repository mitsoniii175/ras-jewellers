// The single source of truth for what a product IS, server-side.
//
// Two layers are merged here:
//   1. the photo catalogue (src/lib/catalog.ts) — identity, SKU, image, the
//      353 real photographs. Static, comes from the filesystem.
//   2. the admin database (product:<sku>) — price, stock, purity, weight,
//      publication. Written by the Admin Dashboard.
//
// Layer 2 wins wherever it has an opinion. A SKU with no admin record behaves
// exactly as it did before Feature 10: Price on Request, untracked stock.
//
// EVERY server-side decision about money or availability must come through
// here — never straight from CATALOG, which knows nothing about stock.

import { CATALOG, type Product } from "@/lib/catalog";
import {
  appendMovement,
  findProductRecord,
  listProductRecords,
  saveProductRecord,
} from "./admin-repo";
import type { ProductRecord, StockReason } from "./admin-types";

/** A catalogue product with the admin's commercial data applied. */
export type MergedProduct = Product & {
  description?: string;
  size?: string;
  gstRate?: number;
  images?: string[];
  videoUrl?: string;
  archived?: boolean;
  /** True when an admin has saved a record for this SKU. */
  managed: boolean;
};

function merge(product: Product, record: ProductRecord | null): MergedProduct {
  if (!record) return { ...product, managed: false };

  return {
    ...product,
    name: record.name?.trim() || product.name,
    description: record.description,
    category: (record.category as Product["category"]) ?? product.category,
    collection: (record.collection as Product["collection"]) ?? product.collection,
    material: (record.metal as Product["material"]) ?? product.material,
    purity: (record.purity as Product["purity"]) ?? product.purity,
    type: (record.type as Product["type"]) ?? product.type,
    weightGrams: record.weightGrams ?? product.weightGrams,
    size: record.size,
    price: record.price,
    makingChargesPct: record.makingChargesPct,
    gstRate: record.gstRate,
    stock: record.stock,
    // An explicit priceOnRequest flag wins; otherwise no price means on request.
    priceOnRequest: record.priceOnRequest || record.price === undefined,
    bisHallmark: record.bisHallmark ?? product.bisHallmark,
    images: record.images,
    videoUrl: record.videoUrl,
    archived: record.archived,
    managed: true,
  };
}

/** One product, merged. Returns null for an unknown or archived SKU. */
export async function getProduct(productId: string): Promise<MergedProduct | null> {
  const base = CATALOG.find((p) => p.id === productId);
  if (!base) return null;
  const merged = merge(base, await findProductRecord(base.code));
  return merged.archived ? null : merged;
}

export async function getProductBySku(sku: string): Promise<MergedProduct | null> {
  const base = CATALOG.find((p) => p.code === sku);
  if (!base) return null;
  return merge(base, await findProductRecord(sku));
}

/**
 * The whole catalogue, merged.
 *
 * `includeHidden` is for the admin dashboard, which must see unpublished and
 * archived pieces. The storefront never passes it.
 */
export async function listProducts(includeHidden = false): Promise<MergedProduct[]> {
  const records = await listProductRecords();
  const bySku = new Map(records.map((r) => [r.sku, r]));

  const merged = CATALOG.map((product) => merge(product, bySku.get(product.code) ?? null));

  if (includeHidden) return merged;
  return merged.filter((p) => !p.archived && isPublished(bySku.get(p.code)));
}

function isPublished(record: ProductRecord | undefined): boolean {
  // Unmanaged products are visible, exactly as they were before Feature 10.
  return record ? record.published : true;
}

/** Commercial attributes only, for the storefront to merge client-side. */
export async function productOverrides(): Promise<
  Record<string, Omit<ProductRecord, "createdAt" | "updatedAt" | "updatedBy">>
> {
  const records = await listProductRecords();
  const out: Record<string, Omit<ProductRecord, "createdAt" | "updatedAt" | "updatedBy">> = {};

  for (const record of records) {
    if (record.archived || !record.published) continue;
    const { createdAt: _c, updatedAt: _u, updatedBy: _b, ...rest } = record;
    out[record.sku] = rest;
  }

  return out;
}

/* -------------------------------------------------------------- mutation -- */

export type SaveProductInput = Partial<Omit<ProductRecord, "sku" | "createdAt" | "updatedAt">> & {
  sku: string;
};

/**
 * Creates or updates a product record.
 *
 * A stock change made here writes an inventory movement automatically, so there
 * is no path that changes stock without leaving an audit trail.
 */
export async function saveProduct(
  input: SaveProductInput,
  actor: { id: string; name: string },
  stockReason: StockReason = "Manual Adjustment",
  note?: string,
): Promise<{ ok: true; record: ProductRecord } | { ok: false; reason: string }> {
  const base = CATALOG.find((p) => p.code === input.sku);
  if (!base) return { ok: false, reason: `No catalogue photo exists for SKU ${input.sku}.` };

  const existing = await findProductRecord(input.sku);
  const now = new Date().toISOString();

  const previousStock = existing?.stock ?? 0;
  const nextStock = input.stock ?? previousStock;

  if (!Number.isInteger(nextStock) || nextStock < 0) {
    return { ok: false, reason: "Stock must be a whole number, zero or more." };
  }
  if (input.price !== undefined && (!Number.isFinite(input.price) || input.price < 0)) {
    return { ok: false, reason: "Price cannot be negative." };
  }

  const record: ProductRecord = {
    ...(existing ?? {
      sku: input.sku,
      stock: 0,
      priceOnRequest: true,
      published: true,
      createdAt: now,
      updatedAt: now,
    }),
    ...input,
    stock: nextStock,
    priceOnRequest: input.priceOnRequest ?? input.price === undefined,
    published: input.published ?? existing?.published ?? true,
    updatedAt: now,
    updatedBy: actor.id,
  };

  const saved = await saveProductRecord(record);

  if (nextStock !== previousStock) {
    await appendMovement({
      sku: saved.sku,
      productName: saved.name ?? base.name,
      previousStock,
      newStock: nextStock,
      change: nextStock - previousStock,
      reason: stockReason,
      note,
      actor: actor.id,
      actorName: actor.name,
    });
  }

  return { ok: true, record: saved };
}

/**
 * Moves stock by a delta, atomically enough for this scale, and records why.
 *
 * `allowNegative` is never true for sales — that is what prevents overselling.
 */
export async function adjustStock(
  sku: string,
  change: number,
  reason: StockReason,
  actor: { id: string; name: string },
  options?: { orderId?: string; note?: string; allowNegative?: boolean },
): Promise<{ ok: true; newStock: number } | { ok: false; reason: string }> {
  const base = CATALOG.find((p) => p.code === sku);
  if (!base) return { ok: false, reason: `Unknown SKU ${sku}.` };

  const existing = await findProductRecord(sku);
  // An unmanaged product has untracked stock; a sale must not invent a number.
  if (!existing) {
    return { ok: false, reason: `${sku} does not track stock yet.` };
  }

  const previousStock = existing.stock;
  const newStock = previousStock + change;

  if (newStock < 0 && !options?.allowNegative) {
    return {
      ok: false,
      reason: `Cannot reduce ${sku} below zero — only ${previousStock} in stock.`,
    };
  }

  await saveProductRecord({ ...existing, stock: newStock, updatedBy: actor.id });

  await appendMovement({
    sku,
    productName: existing.name ?? base.name,
    previousStock,
    newStock,
    change,
    reason,
    note: options?.note,
    actor: actor.id,
    actorName: actor.name,
    orderId: options?.orderId,
  });

  return { ok: true, newStock };
}

/**
 * Deducts stock for a confirmed (paid) order.
 *
 * Called exactly once per order, from the payment-confirmation path — NOT when
 * something is added to a cart. Returns the SKUs that could not be deducted so
 * the caller can flag them; it never silently oversells.
 */
export async function deductStockForOrder(
  orderId: string,
  items: { code: string; qty: number }[],
): Promise<{ deducted: string[]; failed: { sku: string; reason: string }[] }> {
  const deducted: string[] = [];
  const failed: { sku: string; reason: string }[] = [];
  const actor = { id: "system", name: "Automatic (paid order)" };

  for (const item of items) {
    const result = await adjustStock(item.code, -item.qty, "Sale", actor, { orderId });
    if (result.ok) deducted.push(item.code);
    else failed.push({ sku: item.code, reason: result.reason });
  }

  if (failed.length) {
    console.error(`[ras/inventory] stock deduction incomplete for order ${orderId}`, failed);
  }

  return { deducted, failed };
}

/** Puts stock back when an order is cancelled or returned. */
export async function restoreStockForOrder(
  orderId: string,
  items: { code: string; qty: number }[],
  reason: Extract<StockReason, "Cancellation" | "Return">,
  actor: { id: string; name: string },
): Promise<void> {
  for (const item of items) {
    // allowNegative is irrelevant for a positive change, but a missing record
    // simply means the piece never tracked stock — skip rather than invent one.
    await adjustStock(item.code, item.qty, reason, actor, { orderId });
  }
}
