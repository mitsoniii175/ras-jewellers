import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";

import {
  Badge,
  Card,
  Empty,
  Money,
  PageHeader,
  Spinner,
  StatCard,
  Table,
} from "@/components/admin/admin-ui";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/pricing";
import type { Order } from "@/lib/server/types";

export const Route = createFileRoute("/admin/")({
  component: DashboardPage,
});

type Stats = {
  totalOrders: number;
  pendingOrders: number;
  paidOrders: number;
  shippedOrders: number;
  deliveredOrders: number;
  cancelledOrders: number;
  totalCustomers: number;
  totalProducts: number;
  managedProducts: number;
  lowStockProducts: number;
  outOfStockProducts: number;
  revenue: number;
  averageOrderValue: number;
};

type DashboardData = {
  stats: Stats;
  reports: {
    lowStock: { sku: string; name: string; stock: number }[];
    outOfStock: { sku: string; name: string }[];
  };
  recentOrders: Order[];
  lowStockThreshold: number;
};

function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<DashboardData>("/api/admin/dashboard")
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!data) return <Empty message="Could not load the dashboard." />;

  const { stats, reports, recentOrders } = data;

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Everything below is counted from real records." />

      {/* Orders */}
      <section className="mb-6">
        <h2 className="mb-2.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Orders
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <StatCard label="Total" value={stats.totalOrders} />
          <StatCard label="Pending payment" value={stats.pendingOrders} tone="warn" />
          <StatCard label="Paid" value={stats.paidOrders} tone="good" />
          <StatCard label="Shipped" value={stats.shippedOrders} />
          <StatCard label="Delivered" value={stats.deliveredOrders} tone="good" />
          <StatCard label="Cancelled" value={stats.cancelledOrders} />
        </div>
      </section>

      {/* Business */}
      <section className="mb-6">
        <h2 className="mb-2.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          Business
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Revenue (paid)" value={formatMoney(stats.revenue)} tone="good" />
          <StatCard label="Average order" value={formatMoney(stats.averageOrderValue)} />
          <StatCard label="Customers" value={stats.totalCustomers} />
          <StatCard
            label="Products"
            value={stats.totalProducts}
            hint={`${stats.managedProducts} with stock tracked`}
          />
          <StatCard
            label="Needs attention"
            value={stats.lowStockProducts + stats.outOfStockProducts}
            tone={
              stats.outOfStockProducts > 0 ? "bad" : stats.lowStockProducts > 0 ? "warn" : "default"
            }
            hint={`${stats.outOfStockProducts} out, ${stats.lowStockProducts} low`}
          />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        {/* Recent orders */}
        <section>
          <h2 className="mb-2.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Recent orders
          </h2>
          {recentOrders.length === 0 ? (
            <Empty message="No orders yet." />
          ) : (
            <Table head={["Order", "Date", "Total", "Payment", "Status"]}>
              {recentOrders.map((order) => (
                <tr key={order.id} className="hover:bg-secondary/40">
                  <td className="px-4 py-2.5">
                    <Link
                      to="/admin/orders"
                      search={{ id: order.id }}
                      className="font-mono text-xs text-gold-dark hover:underline"
                    >
                      {order.id}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
                    {new Date(order.placedAt).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </td>
                  <td className="px-4 py-2.5">
                    <Money value={order.total} />
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge
                      tone={
                        order.paymentStatus === "Paid"
                          ? "good"
                          : order.paymentStatus === "Pending"
                            ? "warn"
                            : "bad"
                      }
                    >
                      {order.paymentStatus}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={order.status === "Cancelled" ? "bad" : "info"}>
                      {order.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </section>

        {/* Stock alerts */}
        <section>
          <h2 className="mb-2.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Stock alerts
          </h2>
          <Card>
            {reports.outOfStock.length === 0 && reports.lowStock.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">
                {stats.managedProducts === 0
                  ? "No products track stock yet. Set a stock count on a product to start."
                  : "Every tracked piece is in stock."}
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {reports.outOfStock.map((p) => (
                  <li key={p.sku} className="flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                    <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                      {p.name}
                    </span>
                    <Badge tone="bad">Out of stock</Badge>
                  </li>
                ))}
                {reports.lowStock.map((p) => (
                  <li key={p.sku} className="flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                    <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                      {p.name}
                    </span>
                    <Badge tone="warn">{p.stock} left</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      </div>
    </>
  );
}
