import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Loader2, PackageX, Truck } from "lucide-react";

import { AccountHeading, EmptyState, Panel } from "@/components/account/account-chrome";
import {
  money,
  orderDate,
  OrderTimeline,
  PaymentPill,
  StatusPill,
} from "@/components/account/order-bits";
import { RequireAuth } from "@/components/account/require-auth";
import { api } from "@/lib/api";
import type { Order } from "@/lib/server/types";

export const Route = createFileRoute("/account/orders/$orderId")({
  component: () => (
    <RequireAuth>
      <OrderDetailPage />
    </RequireAuth>
  ),
});

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt
        className={strong ? "text-sm font-medium text-foreground" : "text-sm text-muted-foreground"}
      >
        {label}
      </dt>
      <dd
        className={
          strong ? "font-serif text-xl text-foreground" : "text-sm tabular-nums text-foreground"
        }
      >
        {value}
      </dd>
    </div>
  );
}

function OrderDetailPage() {
  const { orderId } = Route.useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // The API looks this id up inside the signed-in customer's own orders, so
    // an id belonging to someone else simply comes back as 404.
    api<{ order: Order }>(`/api/account/orders?id=${encodeURIComponent(orderId)}`)
      .then((res) => setOrder(res.order))
      .catch(() => setOrder(null))
      .finally(() => setLoading(false));
  }, [orderId]);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <Panel className="p-0 md:p-0">
        <EmptyState
          icon={PackageX}
          title="Order not found"
          description="We could not find that order on your account. It may have been placed with a different account."
          action={
            <Link
              to="/account/orders"
              className="inline-flex h-11 items-center rounded-full bg-primary px-7 text-xs font-medium uppercase tracking-[0.18em] text-primary-foreground"
            >
              Back to my orders
            </Link>
          }
        />
      </Panel>
    );
  }

  return (
    <div className="space-y-8">
      <Link
        to="/account/orders"
        className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-gold-dark"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> All orders
      </Link>

      <AccountHeading
        title={order.id}
        subtitle={`Placed on ${orderDate(order.placedAt)}`}
        action={<StatusPill status={order.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Panel className="p-0 md:p-0">
            <h2 className="border-b border-border px-6 py-4 font-serif text-lg text-foreground md:px-8">
              Items in this order
            </h2>
            <ul className="divide-y divide-border">
              {order.items.map((item) => (
                <li key={item.productId} className="flex gap-4 px-6 py-5 md:px-8">
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-20 w-20 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{item.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{item.code}</p>
                    {(item.purity || item.weightGrams) && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {[item.purity, item.weightGrams ? `${item.weightGrams} g` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {money(item.price)} × {item.qty}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-medium text-foreground">
                    {money(item.price * item.qty)}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel>
            <h2 className="font-serif text-lg text-foreground">Order tracking</h2>
            {/* Courier details appear only once a shipment genuinely exists.
                Before dispatch we say so plainly rather than showing an empty
                carrier and a blank tracking number. */}
            {order.shipment?.awb ? (
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg bg-secondary/50 px-4 py-3 text-xs">
                {order.shipment.courier && (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                    <Truck className="h-3.5 w-3.5 text-primary" /> {order.shipment.courier}
                  </span>
                )}
                <span className="font-mono text-foreground">{order.shipment.awb}</span>
                {order.shipment.estimatedDelivery && (
                  <span className="text-muted-foreground">
                    Expected {orderDate(order.shipment.estimatedDelivery)}
                  </span>
                )}
                {order.shipment.trackingUrl && (
                  <a
                    href={order.shipment.trackingUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="ml-auto text-gold-dark hover:underline"
                  >
                    Track with courier
                  </a>
                )}
              </div>
            ) : (
              <p className="mt-4 rounded-lg bg-secondary/50 px-4 py-3 text-xs text-muted-foreground">
                {order.status === "Cancelled"
                  ? "This order was cancelled."
                  : "Your order has not been dispatched yet. Tracking details will appear here as soon as it is handed to the courier."}
              </p>
            )}
            <div className="mt-6">
              <OrderTimeline status={order.status} events={order.tracking?.events} />
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel>
            <h2 className="font-serif text-lg text-foreground">Payment summary</h2>
            <dl className="mt-4 divide-y divide-border">
              <Row label="Subtotal" value={money(order.subtotal)} />
              <Row label="GST" value={money(order.gst)} />
              <Row label="Shipping" value={order.shipping === 0 ? "Free" : money(order.shipping)} />
              <Row label="Total" value={money(order.total)} strong />
            </dl>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-sm">
              <span className="text-muted-foreground">{order.paymentMethod}</span>
              <PaymentPill status={order.paymentStatus} />
            </div>
          </Panel>

          <Panel>
            <h2 className="font-serif text-lg text-foreground">Delivery address</h2>
            <address className="mt-4 text-sm not-italic leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">{order.address.fullName}</span>
              <br />
              {order.address.street}
              <br />
              {order.address.area}, {order.address.city}
              <br />
              {order.address.state} — {order.address.pincode}
              <br />
              +91 {order.address.phone}
            </address>
          </Panel>
        </div>
      </div>
    </div>
  );
}
