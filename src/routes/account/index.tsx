import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Heart, MapPin, Package, Sparkles } from "lucide-react";

import { EmptyState, Panel } from "@/components/account/account-chrome";
import { money, orderDate, StatusPill } from "@/components/account/order-bits";
import { RequireAuth } from "@/components/account/require-auth";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import type { Address, Order } from "@/lib/server/types";
import { useWishlist } from "@/lib/wishlist-store";

export const Route = createFileRoute("/account/")({
  component: () => (
    <RequireAuth>
      <AccountOverview />
    </RequireAuth>
  ),
});

function SummaryTile({
  to,
  icon: Icon,
  value,
  label,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string | number;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="group rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/50"
    >
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-4 font-serif text-3xl leading-none text-foreground">{value}</p>
      <p className="mt-1.5 flex items-center gap-1 text-xs uppercase tracking-[0.12em] text-muted-foreground">
        {label}
        <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
      </p>
    </Link>
  );
}

function AccountOverview() {
  const { customer } = useAuth();
  const { count: wishlistCount } = useWishlist();

  const [orders, setOrders] = useState<Order[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);

  useEffect(() => {
    // Both endpoints are session-scoped, so there is nothing to pass here.
    api<{ orders: Order[] }>("/api/account/orders")
      .then((res) => setOrders(res.orders))
      .catch(() => setOrders([]));
    api<{ addresses: Address[] }>("/api/account/addresses")
      .then((res) => setAddresses(res.addresses))
      .catch(() => setAddresses([]));
  }, []);

  const recent = orders.slice(0, 3);
  const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <SummaryTile to="/account/orders" icon={Package} value={orders.length} label="Orders" />
        <SummaryTile to="/account/wishlist" icon={Heart} value={wishlistCount} label="Wishlist" />
        <SummaryTile
          to="/account/addresses"
          icon={MapPin}
          value={addresses.length}
          label="Addresses"
        />
      </div>

      <Panel className="p-0 md:p-0">
        <div className="flex items-center justify-between border-b border-border px-6 py-5 md:px-8">
          <h2 className="font-serif text-xl text-foreground">Recent orders</h2>
          {orders.length > 0 && (
            <Link
              to="/account/orders"
              className="text-xs uppercase tracking-[0.12em] text-gold-dark hover:underline"
            >
              View all
            </Link>
          )}
        </div>

        {recent.length === 0 ? (
          <EmptyState
            icon={Sparkles}
            title="No orders yet"
            description="When you place your first order with RAS Jewellers, you will be able to follow it here from placement all the way to delivery."
            action={
              <Link
                to="/"
                className="inline-flex h-11 items-center rounded-full bg-primary px-7 text-xs font-medium uppercase tracking-[0.18em] text-primary-foreground"
              >
                Browse collection
              </Link>
            }
          />
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((order) => (
              <li key={order.id}>
                <Link
                  to="/account/orders/$orderId"
                  params={{ orderId: order.id }}
                  className="flex items-center gap-4 px-6 py-5 transition-colors hover:bg-secondary/40 md:px-8"
                >
                  {order.items[0] && (
                    <img
                      src={order.items[0].image}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-lg object-cover"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {order.items[0]?.name ?? "Order"}
                      {order.items.length > 1 && (
                        <span className="text-muted-foreground">
                          {" "}
                          +{order.items.length - 1} more
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {order.id} · {orderDate(order.placedAt)}
                    </p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="text-sm font-medium text-foreground">{money(order.total)}</p>
                    <div className="mt-1">
                      <StatusPill status={order.status} />
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <div className="grid gap-6 md:grid-cols-2">
        <Panel>
          <h2 className="font-serif text-xl text-foreground">Your details</h2>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Name</dt>
              <dd className="text-right font-medium text-foreground">{customer?.name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Mobile</dt>
              <dd className="text-right font-medium text-foreground">+91 {customer?.phone}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="min-w-0 break-all text-right font-medium text-foreground">
                {customer?.email}
              </dd>
            </div>
          </dl>
          <Link
            to="/account/profile"
            className="mt-6 inline-block text-xs uppercase tracking-[0.12em] text-gold-dark hover:underline"
          >
            Edit profile
          </Link>
        </Panel>

        <Panel>
          <h2 className="font-serif text-xl text-foreground">Default address</h2>
          {defaultAddress ? (
            <address className="mt-5 text-sm not-italic leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">{defaultAddress.fullName}</span>
              <br />
              {defaultAddress.street}
              <br />
              {defaultAddress.area}, {defaultAddress.city}
              <br />
              {defaultAddress.state} — {defaultAddress.pincode}
              <br />
              +91 {defaultAddress.phone}
            </address>
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">You have not saved an address yet.</p>
          )}
          <Link
            to="/account/addresses"
            className="mt-6 inline-block text-xs uppercase tracking-[0.12em] text-gold-dark hover:underline"
          >
            {defaultAddress ? "Manage addresses" : "Add an address"}
          </Link>
        </Panel>
      </div>
    </div>
  );
}
