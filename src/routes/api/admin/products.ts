import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { findProductRecord, saveProductRecord } from "@/lib/server/admin-repo";
import { requireAdmin } from "@/lib/server/admin-session";
import { STOCK_REASONS, type StockReason } from "@/lib/server/admin-types";
import { fail, json, readJsonBody } from "@/lib/server/http";
import { listProducts, saveProduct } from "@/lib/server/product-service";
import { route } from "@/lib/server/session";

type SaveBody = {
  sku?: string;
  name?: string;
  description?: string;
  category?: string;
  collection?: string;
  metal?: string;
  purity?: string;
  type?: string;
  weightGrams?: number | string;
  size?: string;
  price?: number | string | null;
  makingChargesPct?: number | string;
  gstRate?: number | string;
  stock?: number | string;
  priceOnRequest?: boolean;
  published?: boolean;
  bisHallmark?: string;
  images?: string[];
  videoUrl?: string;
  stockReason?: StockReason;
  note?: string;
};

/** Coerces a form value to a number, or undefined when blank. */
function num(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function str(value: unknown, max = 500): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : undefined;
}

export const Route = createFileRoute("/api/admin/products")({
  server: {
    handlers: {
      GET: route(async ({ request }) => {
        await requireAdmin(request, "products.view");
        // includeHidden: the admin must see unpublished and archived pieces.
        return json({ ok: true, products: await listProducts(true) });
      }),

      PUT: route(async ({ request }) => {
        const admin = await requireAdmin(request, "products.edit");
        const body = await readJsonBody<SaveBody>(request);
        if (!body?.sku) return fail("A SKU is required.", 400, "sku");

        const reason = body.stockReason;
        if (reason && !(STOCK_REASONS as readonly string[]).includes(reason)) {
          return fail("Unknown stock reason.", 400, "stockReason");
        }

        // Only whitelisted fields are accepted — a caller cannot set
        // createdAt, updatedBy, archived or anything else by sending it.
        const result = await saveProduct(
          {
            sku: body.sku,
            name: str(body.name, 120),
            description: str(body.description, 2000),
            category: str(body.category, 60),
            collection: str(body.collection, 60),
            metal: str(body.metal, 30),
            purity: str(body.purity, 30),
            type: str(body.type, 40),
            size: str(body.size, 40),
            bisHallmark: str(body.bisHallmark, 80),
            videoUrl: str(body.videoUrl, 500),
            images: Array.isArray(body.images)
              ? body.images.filter((i) => typeof i === "string").slice(0, 8)
              : undefined,
            weightGrams: num(body.weightGrams),
            price: body.price === null ? undefined : num(body.price),
            makingChargesPct: num(body.makingChargesPct),
            gstRate: num(body.gstRate),
            stock: num(body.stock),
            priceOnRequest: body.priceOnRequest,
            published: body.published,
          },
          { id: admin.id, name: admin.name },
          reason ?? "Manual Adjustment",
          str(body.note, 200),
        );

        if (!result.ok) return fail(result.reason, 400);
        return json({ ok: true, product: result.record });
      }),

      /**
       * Archive, not destroy. Business records referencing this SKU (past
       * orders, stock movements) must keep resolving, so the record is hidden
       * rather than deleted.
       */
      DELETE: route(async ({ request }) => {
        const admin = await requireAdmin(request, "products.delete");
        const url = new URL(request.url);
        const sku = url.searchParams.get("sku");
        const restore = url.searchParams.get("restore") === "true";
        if (!sku) return fail("A SKU is required.");

        const existing = await findProductRecord(sku);
        if (!existing) return fail("That product has not been set up yet.", 404);

        const saved = await saveProductRecord({
          ...existing,
          archived: !restore,
          published: restore ? existing.published : false,
          updatedBy: admin.id,
        });

        return json({ ok: true, product: saved });
      }),
    },
  },
});
