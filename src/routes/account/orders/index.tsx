import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Loader2, Package } from "lucide-react";

import { AccountHeading, EmptyState, Panel } from "@/components/account/account-chrome";
import { money, orderDate, PaymentPill, StatusPill } from "@/components/account/order-bits";
import { RequireAuth } from "@/components/account/require-auth";
import { api } from "@/lib/api";
import type { Order } from "@/lib/server/types";

export const Route = createFileRoute("/account/orders/")({
  component: () => (
    <RequireAuth>
      <OrdersPage />
    </RequireAuth>
  ),
});

function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ orders: Order[] }>("/api/account/orders")
      .then((res) => setOrders(res.orders))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <AccountHeading
        title="My orders"
        subtitle={
          orders.length > 0
            ? `${orders.length} order${orders.length > 1 ? "s" : ""} with RAS Jewellers`
            : undefined
        }
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : orders.length === 0 ? (
        <Panel className="p-0 md:p-0">
          <EmptyState
            icon={Package}
            title="No orders yet"
            description="Your orders will appear here once you have placed one, and you will be able to follow each piece from our workshop to your door."
            action={
              <Link
                to="/"
                className="inline-flex h-11 items-center rounded-full bg-primary px-7 text-xs font-medium uppercase tracking-[0.18em] text-primary-foreground"
              >
                Browse collection
              </Link>
            }
          />
        </Panel>
      ) : (
        <div className="space-y-5">
          {orders.map((order) => (
            <article
              key={order.id}
              className="overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/40"
            >
              <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-border bg-secondary/40 px-5 py-3.5 md:px-6">
                <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
                  <span className="font-mono text-xs tracking-wide text-foreground">
                    {order.id}
                  </span>
                  <span className="text-xs text-muted-foreground">{orderDate(order.placedAt)}</span>
                </div>
                <StatusPill status={order.status} />
              </header>

              <div className="px-5 py-5 md:px-6">
                <ul className="space-y-4">
                  {order.items.map((item) => (
                    <li key={item.productId} className="flex items-center gap-4">
                      <img
                        src={item.image}
                        alt={item.name}
                        loading="lazy"
                        className="h-16 w-16 shrink-0 rounded-lg object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {item.code} · Qty {item.qty}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm text-muted-foreground">
                        {money(item.price * item.qty)}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>

              <footer className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-t border-border px-5 py-4 md:px-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs uppercase tracking-[0.12em] text-muted-foreground">
                    Total
                  </span>
                  <span className="font-serif text-xl text-foreground">{money(order.total)}</span>
                  <PaymentPill status={order.paymentStatus} />
                </div>
                <Link
                  to="/account/orders/$orderId"
                  params={{ orderId: order.id }}
                  className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-[0.12em] text-gold-dark hover:underline"
                >
                  View details <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </footer>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
