import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { listRateHistory, readRates, writeRates } from "@/lib/server/admin-repo";
import { requireAdmin } from "@/lib/server/admin-session";
import type { MetalRates } from "@/lib/server/admin-types";
import { fail, json, readJsonBody } from "@/lib/server/http";
import { route } from "@/lib/server/session";

type Body = {
  gold22k?: number | string | null;
  gold24k?: number | string | null;
  gold18k?: number | string | null;
  silver?: number | string | null;
};

function rate(value: unknown): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1_000_000) return undefined;
  return Math.round(parsed * 100) / 100;
}

/**
 * Gold and silver rates, typed in by the showroom.
 *
 * These are MANUALLY ENTERED rates carrying a timestamp and an author — they
 * are not a live market feed, and no part of the UI describes them as live.
 * The `source` field exists so a real rate API can be added later and told
 * apart from hand-entered figures.
 */
export const Route = createFileRoute("/api/admin/rates")({
  server: {
    handlers: {
      GET: route(async ({ request }) => {
        await requireAdmin(request, "rates.view");
        return json({ ok: true, rates: await readRates(), history: await listRateHistory() });
      }),

      PUT: route(async ({ request }) => {
        const admin = await requireAdmin(request, "rates.edit");
        const body = await readJsonBody<Body>(request);
        if (!body) return fail("Invalid request.");

        const next: MetalRates = {
          gold22k: rate(body.gold22k),
          gold24k: rate(body.gold24k),
          gold18k: rate(body.gold18k),
          silver: rate(body.silver),
          updatedAt: new Date().toISOString(),
          updatedBy: admin.id,
          updatedByName: admin.name,
          source: "manual",
        };

        return json({ ok: true, rates: await writeRates(next) });
      }),
    },
  },
});
