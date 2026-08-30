import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { listMovements } from "@/lib/server/admin-repo";
import { requireAdmin } from "@/lib/server/admin-session";
import { STOCK_REASONS, type StockReason } from "@/lib/server/admin-types";
import { fail, json, readJsonBody } from "@/lib/server/http";
import { adjustStock } from "@/lib/server/product-service";
import { route } from "@/lib/server/session";

type AdjustBody = { sku?: string; change?: number | string; reason?: StockReason; note?: string };

export const Route = createFileRoute("/api/admin/inventory")({
  server: {
    handlers: {
      /** The movement log — the audit trail for every stock change. */
      GET: route(async ({ request }) => {
        await requireAdmin(request, "inventory.view");
        const sku = new URL(request.url).searchParams.get("sku");
        const movements = await listMovements();
        return json({
          ok: true,
          movements: sku ? movements.filter((m) => m.sku === sku) : movements,
        });
      }),

      POST: route(async ({ request }) => {
        const admin = await requireAdmin(request, "inventory.adjust");
        const body = await readJsonBody<AdjustBody>(request);
        if (!body?.sku) return fail("A SKU is required.", 400, "sku");

        const change = Number(body.change);
        if (!Number.isInteger(change) || change === 0) {
          return fail("Enter a whole number of units to add or remove.", 400, "change");
        }

        const reason = body.reason ?? "Manual Adjustment";
        if (!(STOCK_REASONS as readonly string[]).includes(reason)) {
          return fail("Unknown stock reason.", 400, "reason");
        }
        // "Sale" is written automatically by the payment path; allowing it here
        // would let a manual entry masquerade as a real sale in the audit log.
        if (reason === "Sale") {
          return fail("Sale movements are recorded automatically by paid orders.", 400, "reason");
        }

        const result = await adjustStock(
          body.sku,
          change,
          reason,
          { id: admin.id, name: admin.name },
          { note: typeof body.note === "string" ? body.note.slice(0, 200) : undefined },
        );

        if (!result.ok) return fail(result.reason, 400);
        return json({ ok: true, newStock: result.newStock });
      }),
    },
  },
});
