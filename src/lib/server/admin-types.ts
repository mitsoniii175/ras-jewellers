// Admin accounts, roles and permissions.
//
// Admins are a SEPARATE population from customers, with their own store, their
// own session cookie and their own login page. A customer account can never
// become an admin by any request it can make — the two never mix.

export type AdminRole = "owner" | "manager" | "staff";

/**
 * Every distinct thing an admin can do. Checked on the SERVER for each request;
 * the UI hides what you cannot do, but hiding is a courtesy, not the control.
 */
export type Permission =
  | "dashboard.view"
  | "products.view"
  | "products.edit"
  | "products.delete"
  | "inventory.view"
  | "inventory.adjust"
  | "orders.view"
  | "orders.update"
  | "orders.cancel"
  | "customers.view"
  | "rates.view"
  | "rates.edit"
  | "reports.view"
  | "admins.manage";

const ALL: Permission[] = [
  "dashboard.view",
  "products.view",
  "products.edit",
  "products.delete",
  "inventory.view",
  "inventory.adjust",
  "orders.view",
  "orders.update",
  "orders.cancel",
  "customers.view",
  "rates.view",
  "rates.edit",
  "reports.view",
  "admins.manage",
];

/**
 * Role -> permissions.
 *   owner   — everything, including managing other admins
 *   manager — day-to-day trading, but cannot create admins or delete products
 *   staff   — packing desk: see orders and stock, move orders along, nothing else
 */
export const ROLE_PERMISSIONS: Record<AdminRole, Permission[]> = {
  owner: ALL,
  manager: [
    "dashboard.view",
    "products.view",
    "products.edit",
    "inventory.view",
    "inventory.adjust",
    "orders.view",
    "orders.update",
    "orders.cancel",
    "customers.view",
    "rates.view",
    "rates.edit",
    "reports.view",
  ],
  staff: ["dashboard.view", "products.view", "inventory.view", "orders.view", "orders.update"],
};

export function can(role: AdminRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export type StoredAdmin = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: AdminRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
};

/** What the admin UI is allowed to see about an admin. Never the hash. */
export type PublicAdmin = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  active: boolean;
  createdAt: string;
  lastLoginAt?: string;
  permissions: Permission[];
};

export function toPublicAdmin(admin: StoredAdmin): PublicAdmin {
  return {
    id: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
    active: admin.active,
    createdAt: admin.createdAt,
    lastLoginAt: admin.lastLoginAt,
    permissions: ROLE_PERMISSIONS[admin.role] ?? [],
  };
}

/* --------------------------------------------------------------- products -- */

/**
 * Admin-managed commercial data for one SKU, stored in the database.
 *
 * The 353 catalogue PHOTOS stay where they are (src/assets/products/catalog).
 * This record overlays commercial facts onto them, and is the source of truth
 * once an admin has touched a product.
 */
export type ProductRecord = {
  sku: string;
  /** Overrides the auto-generated name when set. */
  name?: string;
  description?: string;
  category?: string;
  collection?: string;
  metal?: string;
  purity?: string;
  type?: string;
  weightGrams?: number;
  size?: string;
  price?: number;
  makingChargesPct?: number;
  /** Overrides the site-wide GST rate for this piece, if it differs. */
  gstRate?: number;
  stock: number;
  priceOnRequest: boolean;
  published: boolean;
  bisHallmark?: string;
  /** Extra photos beyond the catalogue image, as URLs. */
  images?: string[];
  videoUrl?: string;
  archived?: boolean;
  createdAt: string;
  updatedAt: string;
  updatedBy?: string;
};

/* ------------------------------------------------------------- inventory -- */

export const STOCK_REASONS = [
  "Sale",
  "Manual Adjustment",
  "Restock",
  "Return",
  "Correction",
  "Cancellation",
] as const;

export type StockReason = (typeof STOCK_REASONS)[number];

/** An immutable audit record. Movements are appended, never edited. */
export type StockMovement = {
  id: string;
  sku: string;
  productName: string;
  previousStock: number;
  newStock: number;
  change: number;
  reason: StockReason;
  note?: string;
  /** Admin id, or "system" for automatic movements like a paid order. */
  actor: string;
  actorName: string;
  /** The order that caused this, for Sale/Return/Cancellation. */
  orderId?: string;
  at: string;
};

/* ----------------------------------------------------------------- rates -- */

export type MetalRates = {
  gold22k?: number;
  gold24k?: number;
  gold18k?: number;
  silver?: number;
  /** Recorded automatically whenever a rate is saved. */
  updatedAt: string;
  updatedBy: string;
  updatedByName: string;
  /**
   * Always "manual" today. These are rates typed in by the showroom, NOT a live
   * market feed — the UI must never call them live. A future rate API would set
   * this to its own source name.
   */
  source: "manual";
};
