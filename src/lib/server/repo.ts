// Data access for customer accounts. Every function here is keyed by userId —
// callers must resolve that from the session cookie, never from request input.

import { emailKey, newId } from "./crypto";
import { kvDel, kvGet, kvSet } from "./kv";
import type { Address, Order, StoredUser } from "./types";

const userKey = (id: string) => `user:${id}`;
const sessionKey = (tokenHash: string) => `session:${tokenHash}`;
const resetKey = (tokenHash: string) => `reset:${tokenHash}`;
const addressesKey = (userId: string) => `addresses:${userId}`;
const ordersKey = (userId: string) => `orders:${userId}`;
const wishlistKey = (userId: string) => `wishlist:${userId}`;
const cartKey = (userId: string) => `cart:${userId}`;
const idempotencyKey = (userId: string, key: string) => `idem:${userId}:${key}`;
// Lets a webhook find the owning customer from a Razorpay order id alone.
const rzpIndexKey = (razorpayOrderId: string) => `rzp:${razorpayOrderId}`;
// Lets a courier webhook find the owning customer from an AWB alone.
const awbIndexKey = (awb: string) => `awb:${awb}`;

/* ---------------------------------------------------------------- users -- */

export async function findUserById(id: string): Promise<StoredUser | null> {
  return kvGet<StoredUser>(userKey(id));
}

export async function findUserByEmail(email: string): Promise<StoredUser | null> {
  const pointer = await kvGet<{ userId: string }>(await emailKey(email));
  if (!pointer) return null;
  return findUserById(pointer.userId);
}

export async function createUser(input: {
  name: string;
  phone: string;
  email: string;
  passwordHash: string;
}): Promise<StoredUser> {
  const now = new Date().toISOString();
  const user: StoredUser = {
    id: newId("cus"),
    name: input.name,
    phone: input.phone,
    email: input.email,
    passwordHash: input.passwordHash,
    createdAt: now,
    updatedAt: now,
  };
  await kvSet(userKey(user.id), user);
  await kvSet(await emailKey(user.email), { userId: user.id });
  return user;
}

export async function saveUser(user: StoredUser): Promise<StoredUser> {
  const next = { ...user, updatedAt: new Date().toISOString() };
  await kvSet(userKey(next.id), next);
  return next;
}

/** Moves the email -> userId index when a customer changes their email. */
export async function reindexEmail(oldEmail: string, newEmail: string, userId: string) {
  if (oldEmail === newEmail) return;
  await kvDel(await emailKey(oldEmail));
  await kvSet(await emailKey(newEmail), { userId });
}

/* ------------------------------------------------------------- sessions -- */

export type SessionRecord = { userId: string; createdAt: string; expiresAt: number };

export async function createSession(tokenHash: string, userId: string, ttlMs: number) {
  const record: SessionRecord = {
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: Date.now() + ttlMs,
  };
  await kvSet(sessionKey(tokenHash), record);
}

export async function readSession(tokenHash: string): Promise<SessionRecord | null> {
  const record = await kvGet<SessionRecord>(sessionKey(tokenHash));
  if (!record) return null;
  if (Date.now() > record.expiresAt) {
    await kvDel(sessionKey(tokenHash));
    return null;
  }
  return record;
}

export async function destroySession(tokenHash: string) {
  await kvDel(sessionKey(tokenHash));
}

/* -------------------------------------------------------- password reset -- */

export type ResetRecord = { userId: string; expiresAt: number };

export async function createReset(tokenHash: string, userId: string, ttlMs: number) {
  await kvSet<ResetRecord>(resetKey(tokenHash), { userId, expiresAt: Date.now() + ttlMs });
}

export async function consumeReset(tokenHash: string): Promise<ResetRecord | null> {
  const record = await kvGet<ResetRecord>(resetKey(tokenHash));
  if (!record) return null;
  await kvDel(resetKey(tokenHash));
  if (Date.now() > record.expiresAt) return null;
  return record;
}

/* ----------------------------------------------------------- addresses -- */

export async function listAddresses(userId: string): Promise<Address[]> {
  return (await kvGet<Address[]>(addressesKey(userId))) ?? [];
}

export async function saveAddresses(userId: string, addresses: Address[]): Promise<Address[]> {
  // Exactly one default, and it must exist as long as there's any address.
  let list = addresses;
  if (list.length > 0 && !list.some((a) => a.isDefault)) {
    list = list.map((a, i) => (i === 0 ? { ...a, isDefault: true } : a));
  }
  await kvSet(addressesKey(userId), list);
  return list;
}

/* -------------------------------------------------------------- orders -- */

export async function listOrders(userId: string): Promise<Order[]> {
  const orders = (await kvGet<Order[]>(ordersKey(userId))) ?? [];
  return [...orders].sort((a, b) => b.placedAt.localeCompare(a.placedAt));
}

export async function findOrder(userId: string, orderId: string): Promise<Order | null> {
  const orders = await listOrders(userId);
  return orders.find((o) => o.id === orderId) ?? null;
}

/** Attaches newly created orders to a customer's account. */
export async function appendOrders(userId: string, orders: Order[]): Promise<void> {
  const existing = (await kvGet<Order[]>(ordersKey(userId))) ?? [];
  await kvSet(ordersKey(userId), [...existing, ...orders]);
}

/**
 * Applies a patch to one order, in place. Scoped by userId so an order can only
 * ever be modified within its own customer's account.
 */
export async function updateOrder(
  userId: string,
  orderId: string,
  patch: (order: Order) => Order,
): Promise<Order | null> {
  const orders = (await kvGet<Order[]>(ordersKey(userId))) ?? [];
  const index = orders.findIndex((o) => o.id === orderId);
  if (index === -1) return null;

  const next = patch(orders[index]);
  orders[index] = next;
  await kvSet(ordersKey(userId), orders);
  return next;
}

/* -------------------------------------------------- razorpay order index -- */

/** Points a provider reference (Razorpay order id, courier AWB) at an order. */
export type OrderIndexEntry = { userId: string; orderId: string };

export async function indexRazorpayOrder(razorpayOrderId: string, entry: OrderIndexEntry) {
  await kvSet(rzpIndexKey(razorpayOrderId), entry);
}

export async function lookupRazorpayOrder(
  razorpayOrderId: string,
): Promise<OrderIndexEntry | null> {
  return kvGet<OrderIndexEntry>(rzpIndexKey(razorpayOrderId));
}

/* ------------------------------------------------------- shipment index -- */

export async function indexShipment(awb: string, entry: OrderIndexEntry) {
  await kvSet(awbIndexKey(awb), entry);
}

export async function lookupShipment(awb: string): Promise<OrderIndexEntry | null> {
  return kvGet<OrderIndexEntry>(awbIndexKey(awb));
}

/* ---------------------------------------------------------------- cart -- */

export type StoredCartLine = { productId: string; qty: number };

export async function readCart(userId: string): Promise<StoredCartLine[]> {
  return (await kvGet<StoredCartLine[]>(cartKey(userId))) ?? [];
}

export async function writeCart(
  userId: string,
  lines: StoredCartLine[],
): Promise<StoredCartLine[]> {
  // Collapse duplicates by taking the HIGHEST quantity rather than the sum.
  // Merging a guest bag into an account bag has to be idempotent: summing means
  // a customer who logs in twice on the same device silently ends up with
  // double the pieces they actually chose.
  const merged = new Map<string, number>();
  for (const line of lines) {
    merged.set(line.productId, Math.max(merged.get(line.productId) ?? 0, line.qty));
  }
  const next = [...merged.entries()].map(([productId, qty]) => ({ productId, qty })).slice(0, 100);

  await kvSet(cartKey(userId), next);
  return next;
}

/* --------------------------------------------------- order idempotency -- */

/**
 * Remembers which order a given checkout attempt produced, so a retry, a
 * refresh or a double-tap replays the SAME order instead of creating another.
 * Kept for 24h — long enough to cover any realistic retry.
 */
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

type IdempotencyRecord = { orderId: string; expiresAt: number };

export async function findOrderIdForKey(userId: string, key: string): Promise<string | null> {
  const record = await kvGet<IdempotencyRecord>(idempotencyKey(userId, key));
  if (!record) return null;
  if (Date.now() > record.expiresAt) {
    await kvDel(idempotencyKey(userId, key));
    return null;
  }
  return record.orderId;
}

export async function rememberOrderForKey(userId: string, key: string, orderId: string) {
  await kvSet<IdempotencyRecord>(idempotencyKey(userId, key), {
    orderId,
    expiresAt: Date.now() + IDEMPOTENCY_TTL_MS,
  });
}

/* ------------------------------------------------------------ wishlist -- */

export async function readWishlist(userId: string): Promise<string[]> {
  return (await kvGet<string[]>(wishlistKey(userId))) ?? [];
}

export async function writeWishlist(userId: string, productIds: string[]): Promise<string[]> {
  const unique = Array.from(new Set(productIds)).slice(0, 500);
  await kvSet(wishlistKey(userId), unique);
  return unique;
}
