import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { siteOrigin } from "@/lib/site-url";

/**
 * XML sitemap.
 *
 * Only PUBLIC, indexable pages belong here. Account, cart, checkout, order
 * status and admin are all either private or transactional — listing them
 * would invite search engines to crawl pages that always redirect to a login.
 */
interface SitemapEntry {
  path: string;
  changefreq?: "weekly" | "daily" | "monthly" | "yearly";
  priority?: string;
}

const ENTRIES: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/shop", changefreq: "weekly", priority: "0.9" },
  { path: "/about", changefreq: "monthly", priority: "0.7" },
  { path: "/enquire", changefreq: "monthly", priority: "0.6" },
];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Absolute <loc> values are required by the sitemap protocol; the old
        // relative ones were silently invalid.
        const origin = siteOrigin(request);
        const lastmod = new Date().toISOString().slice(0, 10);

        const urls = ENTRIES.map((entry) =>
          [
            `  <url>`,
            `    <loc>${origin}${entry.path}</loc>`,
            `    <lastmod>${lastmod}</lastmod>`,
            entry.changefreq ? `    <changefreq>${entry.changefreq}</changefreq>` : null,
            entry.priority ? `    <priority>${entry.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
