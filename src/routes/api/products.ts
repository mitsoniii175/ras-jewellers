import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { json } from "@/lib/server/http";
import { productOverrides } from "@/lib/server/product-service";
import { route } from "@/lib/server/session";

/**
 * PUBLIC. The commercial data an admin has recorded, keyed by SKU, so the
 * storefront can show real prices and stock.
 *
 * Only published, non-archived products are included, and only fields a
 * shopper is allowed to see. The server remains the authority: this is for
 * DISPLAY, and checkout re-derives every figure regardless of what the browser
 * believes.
 */
export const Route = createFileRoute("/api/products")({
  server: {
    handlers: {
      GET: route(async () => {
        return json(
          { ok: true, overrides: await productOverrides() },
          // Short public cache: prices change rarely, and checkout re-validates.
          { headers: { "cache-control": "public, max-age=60" } },
        );
      }),
    },
  },
});
