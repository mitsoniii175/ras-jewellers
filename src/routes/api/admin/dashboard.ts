import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { allCustomers, allOrders } from "@/lib/server/admin-queries";
import { requireAdmin } from "@/lib/server/admin-session";
import { json } from "@/lib/server/http";
import { listProducts } from "@/lib/server/product-service";
import { route } from "@/lib/server/session";

/** A managed product at or below this many units is "low stock". */
const LOW_STOCK_THRESHOLD = 3;

/**
 * Dashboard counters and reports.
 *
 * Every figure is computed from the actual stored records — there are no
 * estimates and no sample data. An empty business correctly shows zeroes.
 */
export const Route = createFileRoute("/api/admin/dashboard")({
  server: {
    handlers: {
      GET: route(async ({ request }) => {
        await requireAdmin(request, "dashboard.view");

        const [orders, customers, products] = await Promise.all([
          allOrders(),
          allCustomers(),
          listProducts(true),
        ]);

        const live = orders.filter((o) => o.status !== "Cancelled");
        const paid = orders.filter((o) => o.paymentStatus === "Paid");

        // Stock counters only consider products an admin has actually set up —
        // an untracked piece is not "out of stock", it simply has no count.
        const managed = products.filter((p) => p.managed && !p.archived);
        const outOfStock = managed.filter((p) => (p.stock ?? 0) <= 0);
        const lowStock = managed.filter(
          (p) => (p.stock ?? 0) > 0 && (p.stock ?? 0) <= LOW_STOCK_THRESHOLD,
        );

        const revenue = paid.reduce((sum, o) => sum + o.total, 0);

        /* ------------------------------------------------------- reports -- */

        const dailySales = groupSales(paid, (iso) => iso.slice(0, 10));
        const monthlySales = groupSales(paid, (iso) => iso.slice(0, 7));

        // Top products by units actually sold (paid orders only).
        const unitsBySku = new Map<string, { name: string; units: number; revenue: number }>();
        for (const order of paid) {
          for (const item of order.items) {
            const entry = unitsBySku.get(item.code) ?? { name: item.name, units: 0, revenue: 0 };
            entry.units += item.qty;
            entry.revenue += item.price * item.qty;
            unitsBySku.set(item.code, entry);
          }
        }
        const topProducts = [...unitsBySku.entries()]
          .map(([sku, v]) => ({ sku, ...v }))
          .sort((a, b) => b.units - a.units)
          .slice(0, 10);

        return json({
          ok: true,
          stats: {
            totalOrders: orders.length,
            pendingOrders: live.filter((o) => o.paymentStatus === "Pending").length,
            paidOrders: paid.length,
            shippedOrders: live.filter((o) => ["Shipped", "Out for Delivery"].includes(o.status))
              .length,
            deliveredOrders: orders.filter((o) => o.status === "Delivered").length,
            cancelledOrders: orders.filter((o) => o.status === "Cancelled").length,
            totalCustomers: customers.length,
            totalProducts: products.filter((p) => !p.archived).length,
            managedProducts: managed.length,
            lowStockProducts: lowStock.length,
            outOfStockProducts: outOfStock.length,
            revenue,
            averageOrderValue: paid.length ? Math.round(revenue / paid.length) : 0,
          },
          reports: {
            dailySales: dailySales.slice(0, 30),
            monthlySales: monthlySales.slice(0, 12),
            topProducts,
            lowStock: lowStock.map((p) => ({ sku: p.code, name: p.name, stock: p.stock ?? 0 })),
            outOfStock: outOfStock.map((p) => ({ sku: p.code, name: p.name })),
          },
          recentOrders: orders.slice(0, 8),
          lowStockThreshold: LOW_STOCK_THRESHOLD,
        });
      }),
    },
  },
});

function groupSales(
  orders: { placedAt: string; total: number }[],
  key: (iso: string) => string,
): { period: string; orders: number; revenue: number }[] {
  const buckets = new Map<string, { orders: number; revenue: number }>();

  for (const order of orders) {
    const period = key(order.placedAt);
    const entry = buckets.get(period) ?? { orders: 0, revenue: 0 };
    entry.orders += 1;
    entry.revenue += order.total;
    buckets.set(period, entry);
  }

  return [...buckets.entries()]
    .map(([period, v]) => ({ period, ...v }))
    .sort((a, b) => b.period.localeCompare(a.period));
}
