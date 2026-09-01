// The site's canonical origin, e.g. "https://rasjewellers.com".
//
// Search engines need ABSOLUTE urls in sitemaps, canonical tags and Open Graph
// images. Hard-coding the domain means every future domain change is a code
// change, so instead we resolve it at runtime in this order:
//
//   1. SITE_URL          — set this by hand to override everything
//   2. URL               — set automatically by Netlify to the site's PRIMARY
//                          domain. Once a custom domain is made primary in the
//                          Netlify UI, this becomes that domain with no deploy.
//   3. DEPLOY_PRIME_URL  — Netlify branch/preview deploys
//   4. the incoming request's own origin — last resort, always correct
//
// The practical effect: buy a domain, set it as primary in Netlify, and every
// canonical tag, og:url and sitemap entry follows automatically.

function env(name: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  const value = process.env?.[name];
  return value && value.trim() ? value.trim() : undefined;
}

function normalise(url: string): string {
  // No trailing slash, so `${origin}${path}` never doubles up.
  return url.replace(/\/+$/, "");
}

/**
 * Resolves the canonical origin. Pass the current Request when one is
 * available — it guarantees a correct value even with no env vars set.
 */
export function siteOrigin(request?: Request): string {
  const configured = env("SITE_URL") ?? env("URL") ?? env("DEPLOY_PRIME_URL");
  if (configured) return normalise(configured);

  if (request) {
    try {
      const url = new URL(request.url);
      // Netlify terminates TLS upstream, so trust the forwarded protocol.
      const proto = request.headers.get("x-forwarded-proto")?.split(",")[0].trim();
      return normalise(`${proto ?? url.protocol.replace(":", "")}://${url.host}`);
    } catch {
      // fall through
    }
  }

  return "";
}

/** Absolute url for a path, e.g. absoluteUrl("/shop") -> "https://…/shop". */
export function absoluteUrl(path: string, request?: Request): string {
  const origin = siteOrigin(request);
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return origin ? `${origin}${suffix}` : suffix;
}
