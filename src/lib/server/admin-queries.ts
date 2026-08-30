// Read models for the admin dashboard.
//
// Orders live per-customer (orders:<userId>), which is right for the storefront
// but means any admin-wide view has to fan out across the customer directory.
// At showroom scale that is fine; if the customer count ever grows large,
// replace these with a maintained index rather than a fan-out.

import { listCustomerIds } from "./admin-repo";
import { findUserById, listOrders } from "./repo";
import type { Order } from "./types";

export type OrderWithCustomer = Order & {
  customer: { id: string; name: string; email: string; phone: string } | null;
};

/** Every order in the business, newest first. */
export async function allOrders(): Promise<OrderWithCustomer[]> {
  const ids = await listCustomerIds();
  const out: OrderWithCustomer[] = [];

  for (const userId of ids) {
    const [user, orders] = await Promise.all([findUserById(userId), listOrders(userId)]);
    const customer = user
      ? { id: user.id, name: user.name, email: user.email, phone: user.phone }
      : null;
    for (const order of orders) out.push({ ...order, customer });
  }

  return out.sort((a, b) => b.placedAt.localeCompare(a.placedAt));
}

export type CustomerSummary = {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  orderCount: number;
  totalSpent: number;
};

/**
 * Customer directory with order totals.
 *
 * Password hashes are never read here, let alone returned — the admin UI has no
 * route through which a password could be viewed.
 */
export async function allCustomers(): Promise<CustomerSummary[]> {
  const ids = await listCustomerIds();
  const summaries: CustomerSummary[] = [];

  for (const userId of ids) {
    const user = await findUserById(userId);
    if (!user) continue;

    const orders = await listOrders(userId);
    // Only money actually taken counts towards lifetime value.
    const paid = orders.filter((o) => o.paymentStatus === "Paid");

    summaries.push({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      createdAt: user.createdAt,
      orderCount: orders.length,
      totalSpent: paid.reduce((sum, o) => sum + o.total, 0),
    });
  }

  return summaries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Locates an order across all customers, for the admin order detail view. */
export async function findOrderAnywhere(
  orderId: string,
): Promise<{ userId: string; order: OrderWithCustomer } | null> {
  const ids = await listCustomerIds();

  for (const userId of ids) {
    const orders = await listOrders(userId);
    const order = orders.find((o) => o.id === orderId);
    if (!order) continue;

    const user = await findUserById(userId);
    return {
      userId,
      order: {
        ...order,
        customer: user
          ? { id: user.id, name: user.name, email: user.email, phone: user.phone }
          : null,
      },
    };
  }

  return null;
}
