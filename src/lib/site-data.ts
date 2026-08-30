import { CATALOG, CATALOG_CATEGORIES, type Material } from "@/lib/catalog";

export const SITE = {
  name: "RAS JEWELLERS",
  phone: "+91 98987 62093",
  whatsapp: "919898762093",
  email: "info@rasjewellers.com",
  established: "Est. 2000 · 25+ Years of Trust",
  instagram: "https://instagram.com/rasjewellers", // TODO: replace with your real Instagram handle/link
};

/**
 * Today's rates — EDIT THESE BY HAND EVERY DAY.
 * Leave a value as `null` to hide that line on the site until you fill it in.
 * Example: goldRate22k: 6540  ->  shows "22K Gold · Rs 6,540 / gram"
 */
export const RATES: {
  goldRate22k: number | null;
  goldRate24k: number | null;
  silverRate: number | null;
  updatedOn: string | null;
} = {
  goldRate22k: null,
  goldRate24k: null,
  silverRate: null,
  updatedOn: null,
};

export const ANNOUNCEMENTS = [
  "100% BIS Hallmarked Jewellery",
  "HUID Enabled",
  "22K & 24K Gold",
  "Two Showrooms · Haldharvas & Khatlal",
  "Trusted for 25+ Years in Gujarat",
];

export const NAV = [
  { label: "Investment Plan", items: ["Gold Savings", "Monthly Plan"] },
  { label: "Home", items: [] },
  { label: "Our Brands", items: ["RAS Gold", "RAS Silver", "RAS Diamonds"] },
  { label: "Shop", items: ["Rings", "Necklaces", "Earrings", "Bangles", "Chains"] },
  { label: "Collection", items: ["Bridal", "Wedding", "Daily Wear", "Antique"] },
  { label: "Gifts", items: ["For Her", "For Him", "For Kids"] },
  { label: "Product Family", items: ["Gold", "Silver", "Diamond"] },
  { label: "Enquire", items: [] },
];

export type { Material, Product, CategorySlug } from "@/lib/catalog";

// Full real product catalog, built from your uploaded photos (see src/lib/catalog.ts).
export const TRENDING = CATALOG;

// Category tiles shown in the "Shop by Category" section — one per real
// category folder, using an actual photo from that category as the tile image.
export const CATEGORIES = CATALOG_CATEGORIES.map((c) => ({
  slug: c.slug,
  title: c.label,
  image: c.image,
  count: c.count,
}));

/**
 * Gold & Silver collection banners, using real photos from the catalog.
 */
export const MATERIAL_COLLECTIONS: {
  title: string;
  material: Material;
  description: string;
  image: string;
}[] = [
  {
    title: "Gold Collection",
    material: "gold",
    description: "22K & 24K BIS hallmarked gold, handcrafted for everyday elegance and celebration.",
    image: CATALOG.find((p) => p.material === "gold")?.image ?? "",
  },
  {
    title: "Silver Collection",
    material: "silver",
    description: "925 sterling silver pieces — light, versatile and made for daily wear.",
    image: CATALOG.find((p) => p.material === "silver")?.image ?? "",
  },
];
