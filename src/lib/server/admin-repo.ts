// Storage for admins, products, inventory movements and metal rates.
//
// Kept separate from repo.ts (customer data) so the two populations never share
// a key namespace by accident.

import { hashToken, newId } from "./crypto";
import { kvGet, kvSet } from "./kv";
import type {
  AdminRole,
  MetalRates,
  ProductRecord,
  StockMovement,
  StoredAdmin,
} from "./admin-types";

const adminKey = (id: string) => `admin:${id}`;
const adminIndexKey = "admin:index";
const productKey = (sku: string) => `product:${sku}`;
const productIndexKey = "product:index";
const movementsKey = "inventory:movements";
const ratesKey = "rates:current";
const ratesHistoryKey = "rates:history";

async function adminEmailKey(email: string): Promise<string> {
  return `adminemail:${await hashToken(email.trim().toLowerCase())}`;
}

/* ---------------------------------------------------------------- admins -- */

/** Ids of every admin, so the list page does not need a key scan. */
async function adminIds(): Promise<string[]> {
  return (await kvGet<string[]>(adminIndexKey)) ?? [];
}

export async function countAdmins(): Promise<number> {
  return (await adminIds()).length;
}

export async function findAdminById(id: string): Promise<StoredAdmin | null> {
  return kvGet<StoredAdmin>(adminKey(id));
}

export async function findAdminByEmail(email: string): Promise<StoredAdmin | null> {
  const pointer = await kvGet<{ adminId: string }>(await adminEmailKey(email));
  if (!pointer) return null;
  return findAdminById(pointer.adminId);
}

export async function listAdmins(): Promise<StoredAdmin[]> {
  const ids = await adminIds();
  const admins = await Promise.all(ids.map((id) => findAdminById(id)));
  return admins.filter((a): a is StoredAdmin => a !== null);
}

export async function createAdmin(input: {
  name: string;
  email: string;
  passwordHash: string;
  role: AdminRole;
}): Promise<StoredAdmin> {
  const now = new Date().toISOString();
  const admin: StoredAdmin = {
    id: newId("adm"),
    name: input.name,
    email: input.email.trim().toLowerCase(),
    passwordHash: input.passwordHash,
    role: input.role,
    active: true,
    createdAt: now,
    updatedAt: now,
  };
  await kvSet(adminKey(admin.id), admin);
  await kvSet(await adminEmailKey(admin.email), { adminId: admin.id });
  await kvSet(adminIndexKey, [...(await adminIds()), admin.id]);
  return admin;
}

export async function saveAdmin(admin: StoredAdmin): Promise<StoredAdmin> {
  const next = { ...admin, updatedAt: new Date().toISOString() };
  await kvSet(adminKey(next.id), next);
  return next;
}

/* --------------------------------------------------------------- products -- */

async function productSkus(): Promise<string[]> {
  return (await kvGet<string[]>(productIndexKey)) ?? [];
}

export async function findProductRecord(sku: string): Promise<ProductRecord | null> {
  return kvGet<ProductRecord>(productKey(sku));
}

export async function listProductRecords(): Promise<ProductRecord[]> {
  const skus = await productSkus();
  const records = await Promise.all(skus.map((sku) => findProductRecord(sku)));
  return records.filter((r): r is ProductRecord => r !== null);
}

export async function saveProductRecord(record: ProductRecord): Promise<ProductRecord> {
  const next = { ...record, updatedAt: new Date().toISOString() };
  await kvSet(productKey(next.sku), next);

  const skus = await productSkus();
  if (!skus.includes(next.sku)) await kvSet(productIndexKey, [...skus, next.sku]);

  return next;
}

/* -------------------------------------------------------------- inventory -- */

const MAX_MOVEMENTS = 2000;

export async function listMovements(): Promise<StockMovement[]> {
  return (await kvGet<StockMovement[]>(movementsKey)) ?? [];
}

/**
 * Appends an immutable stock-movement record.
 *
 * Movements are the audit trail for every stock change — nothing may alter
 * stock without writing one, so the numbers can always be explained.
 */
export async function appendMovement(
  movement: Omit<StockMovement, "id" | "at">,
): Promise<StockMovement> {
  const record: StockMovement = {
    ...movement,
    id: newId("mov"),
    at: new Date().toISOString(),
  };
  const existing = await listMovements();
  // Newest first, capped so the log cannot grow without bound.
  await kvSet(movementsKey, [record, ...existing].slice(0, MAX_MOVEMENTS));
  return record;
}

/* ------------------------------------------------------------------ rates -- */

export async function readRates(): Promise<MetalRates | null> {
  return kvGet<MetalRates>(ratesKey);
}

export async function writeRates(rates: MetalRates): Promise<MetalRates> {
  await kvSet(ratesKey, rates);
  const history = (await kvGet<MetalRates[]>(ratesHistoryKey)) ?? [];
  await kvSet(ratesHistoryKey, [rates, ...history].slice(0, 365));
  return rates;
}

export async function listRateHistory(): Promise<MetalRates[]> {
  return (await kvGet<MetalRates[]>(ratesHistoryKey)) ?? [];
}

/* --------------------------------------------------- customer directory -- */

/**
 * Customers are keyed by id with no global index (they sign themselves up), so
 * the admin customer list needs one. Maintained on signup.
 */
const customerIndexKey = "customer:index";

export async function indexCustomer(userId: string): Promise<void> {
  const ids = (await kvGet<string[]>(customerIndexKey)) ?? [];
  if (!ids.includes(userId)) await kvSet(customerIndexKey, [...ids, userId]);
}

export async function listCustomerIds(): Promise<string[]> {
  return (await kvGet<string[]>(customerIndexKey)) ?? [];
}
