import { CATALOG, CATALOG_CATEGORIES, type Material } from "@/lib/catalog";

export const SITE = {
  name: "RAS JEWELLERS",
  phone: "+91 98987 62093",
  whatsapp: "919898762093",
  email: "info@rasjewellers.com",
  established: "Est. 2000 · 25+ Years of Trust",
  instagram: "https://www.instagram.com/rasjewelsofficial",
  facebook: "https://www.facebook.com/ras.jewellery.2025",
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

/**
 * The two showrooms.
 *
 * `mapUrl` is left empty until the real Google Maps links are supplied — a
 * guessed map pin would send customers to the wrong shop, which is worse than
 * showing no map button at all. To fill these in: open Google Maps, find the
 * showroom, tap Share, Copy link, and paste it below.
 */
export const SHOWROOMS: {
  name: string;
  address: string;
  mapUrl: string;
  hours?: string;
}[] = [
  {
    name: "Haldharvas Showroom",
    address: "Haldharvas, Gujarat",
    mapUrl: "",
  },
  {
    name: "Khatlal Showroom",
    address: "Khatlal, Gujarat",
    mapUrl: "",
  },
];

/** Long-form brand story, shown on /about. */
export const ABOUT = {
  established: "2000",
  paragraphs: [
    "For over 25 years, RAS JEWELLERS has been a symbol of trust, purity, and timeless craftsmanship. Our journey began in Haldharvas, where we earned the confidence of generations through genuine quality, transparent service, and beautifully crafted jewellery. Today, with the opening of our new showroom in Khatlal, we are proud to bring the same legacy of excellence to even more families.",
    "Every jewellery piece we create tells a story. From elegant everyday collections to magnificent bridal masterpieces, our carefully curated range of Gold, Silver and Bridal Jewellery is designed to celebrate life's most precious moments. Each design reflects exceptional artistry, certified purity, and attention to every detail.",
    "At RAS JEWELLERS, we believe jewellery is more than an accessory. It is a reflection of tradition, love, achievement, and memories that are cherished for generations. Our commitment to authenticity, fair pricing, and personalized customer service has made us a trusted destination for thousands of happy customers.",
    "Whether you're celebrating a wedding, an anniversary, a festival, or simply looking for something special, our experienced team is dedicated to helping you find the perfect piece that matches your style and emotions.",
    "Visit us at our Haldharvas or Khatlal showroom and experience a world where heritage meets modern elegance.",
  ],
  promises: [
    "25+ Years of Trusted Excellence",
    "Certified Purity & Quality Assurance",
    "Exclusive Gold & Silver Collections",
    "Bridal Jewellery Specialists",
    "Transparent Pricing",
    "Personalized Customer Service",
  ],
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
  { label: "About", items: [] },
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
    description:
      "22K & 24K BIS hallmarked gold, handcrafted for everyday elegance and celebration.",
    image: CATALOG.find((p) => p.material === "gold")?.image ?? "",
  },
  {
    title: "Silver Collection",
    material: "silver",
    description: "925 sterling silver pieces — light, versatile and made for daily wear.",
    image: CATALOG.find((p) => p.material === "silver")?.image ?? "",
  },
];
