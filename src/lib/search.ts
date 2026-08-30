// Global jewellery search over the real catalogue.
//
// Everything here matches against data that actually exists on a product —
// name, SKU, category, metal, and (once recorded) type, purity and collection.
// A query with no genuine match returns nothing, deliberately: a jewellery
// search that pads its results with near-misses is worse than one that says so.

import { CATALOG, isInStock, type Product } from "@/lib/catalog";

export type SearchResult = {
  product: Product;
  score: number;
};

/** Words that carry no meaning for a jewellery search. */
const STOP_WORDS = new Set(["the", "a", "an", "for", "with", "in", "of", "and", "my", "me"]);

/**
 * Query words that mean the same thing as a value in the data. Lets "mangalsutra"
 * find a piece typed as Mangalsutra, and "22 carat" find 22K.
 *
 * This maps language onto real fields — it never invents a match. If nothing in
 * the catalogue is typed "Ring", searching "ring" correctly finds nothing.
 */
const SYNONYMS: Record<string, string[]> = {
  // Jewellery types
  ring: ["ring"],
  rings: ["ring"],
  necklace: ["necklace", "necklaces"],
  necklaces: ["necklace"],
  haar: ["necklace"],
  mangalsutra: ["mangalsutra"],
  bangle: ["bangle", "bangles"],
  bangles: ["bangle"],
  kada: ["bangle"],
  bracelet: ["bracelet"],
  earring: ["earrings"],
  earrings: ["earrings"],
  jhumka: ["earrings"],
  jhumkas: ["earrings"],
  studs: ["earrings"],
  chain: ["chain"],
  pendant: ["pendant"],
  payal: ["payal"],
  anklet: ["payal"],
  set: ["set"],

  // Metals
  gold: ["gold"],
  golden: ["gold"],
  silver: ["silver"],
  sterling: ["silver", "925"],
  diamond: ["diamond"],
  diamonds: ["diamond"],

  // Purity
  carat: [],
  kt: [],
  k: [],
  "22": ["22k"],
  "24": ["24k"],
  "18": ["18k"],
  "925": ["925 silver"],

  // Collections / audience
  bridal: ["bridal"],
  wedding: ["wedding"],
  daily: ["daily wear"],
  antique: ["antique"],
  festive: ["festive"],
  mens: ["men's"],
  men: ["men's"],
  gents: ["men's"],
  womens: ["women's"],
  women: ["women's"],
  ladies: ["women's"],
};

function tokenize(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s'-]/gu, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0 && !STOP_WORDS.has(t));
}

/** Every lowercase string a product can legitimately be matched on. */
function haystack(product: Product): string[] {
  return [
    product.name,
    product.code,
    product.code.replace("-", ""),
    product.categoryLabel,
    product.category,
    product.material,
    product.type ?? "",
    product.purity ?? "",
    product.collection ?? "",
  ]
    .filter(Boolean)
    .map((s) => s.toLowerCase());
}

/**
 * Scores one product against one token. Higher is a better match:
 *   4 = exact SKU        3 = word-start in name/type
 *   2 = substring        0 = no match
 */
function scoreToken(product: Product, token: string, fields: string[]): number {
  // An exact SKU match should always win.
  if (
    product.code.toLowerCase() === token ||
    product.code.toLowerCase().replace("-", "") === token
  ) {
    return 4;
  }

  const expansions = SYNONYMS[token] ?? [token];
  // A token like "carat" expands to nothing — it is filler, not a constraint.
  if (expansions.length === 0) return 1;

  let best = 0;
  for (const term of expansions) {
    for (const field of fields) {
      if (field === term) best = Math.max(best, 3);
      else if (new RegExp(`\\b${escapeRegex(term)}`).test(field)) best = Math.max(best, 3);
      else if (field.includes(term)) best = Math.max(best, 2);
    }
  }
  return best;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Searches the catalogue. Every token must match something (AND semantics), so
 * "gold ring" does not fall back to every gold item.
 */
export function searchProducts(query: string, source: Product[] = CATALOG): SearchResult[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const results: SearchResult[] = [];

  for (const product of source) {
    const fields = haystack(product);
    let total = 0;
    let matchedAll = true;

    for (const token of tokens) {
      const score = scoreToken(product, token, fields);
      if (score === 0) {
        matchedAll = false;
        break;
      }
      total += score;
    }

    if (matchedAll) {
      // Nudge in-stock pieces above out-of-stock ones.
      results.push({ product, score: total + (isInStock(product) ? 0.5 : 0) });
    }
  }

  return results.sort((a, b) => b.score - a.score || a.product.code.localeCompare(b.product.code));
}

export type Suggestion =
  | { kind: "product"; product: Product }
  | { kind: "term"; label: string; query: string; count: number };

/**
 * Type-ahead suggestions: a few matching pieces, plus the categories and metals
 * those matches fall into so the customer can widen out to a whole group.
 */
export function suggestFor(query: string, limit = 6, source: Product[] = CATALOG): Suggestion[] {
  const matches = searchProducts(query, source);
  if (matches.length === 0) return [];

  const suggestions: Suggestion[] = matches
    .slice(0, limit - 2)
    .map(({ product }) => ({ kind: "product", product }));

  // Group the full result set by category so we can offer "all 45 of these".
  const byCategory = new Map<string, number>();
  for (const { product } of matches) {
    byCategory.set(product.categoryLabel, (byCategory.get(product.categoryLabel) ?? 0) + 1);
  }

  const topCategories = [...byCategory.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .filter(([, count]) => count > 1);

  for (const [label, count] of topCategories) {
    suggestions.push({ kind: "term", label, query: label, count });
  }

  return suggestions;
}
