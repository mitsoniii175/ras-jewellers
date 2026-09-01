import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { siteOrigin } from "@/lib/site-url";

/**
 * Served as a route rather than a static file so the Sitemap: line can carry
 * the absolute url of whichever domain is actually serving the site. The
 * sitemap protocol requires an absolute url there, so a static file would have
 * to hard-code the domain.
 */
export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = siteOrigin(request);

        const body = [
          "User-agent: *",
          "Allow: /",
          "",
          "# Private and transactional pages — nothing here is useful in search",
          "# results, and most of it redirects to a login anyway.",
          "Disallow: /account",
          "Disallow: /admin",
          "Disallow: /cart",
          "Disallow: /checkout",
          "Disallow: /order-status",
          "Disallow: /api/",
          "",
          origin ? `Sitemap: ${origin}/sitemap.xml` : "",
        ]
          .filter((line) => line !== undefined)
          .join("\n");

        return new Response(body, {
          headers: { "Content-Type": "text/plain", "Cache-Control": "public, max-age=3600" },
        });
      },
    },
  },
});
