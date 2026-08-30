import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  MessageCircle,
  RefreshCw,
  ShoppingBag,
} from "lucide-react";
import { toast } from "sonner";

import { AnnouncementBar } from "@/components/site/announcement-bar";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { GoldRule } from "@/components/account/account-chrome";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { payForOrder } from "@/lib/payment-flow";
import { formatMoney } from "@/lib/pricing";
import type { Order } from "@/lib/server/types";
import { SITE } from "@/lib/site-data";
import { cn } from "@/lib/utils";

/**
 * The page a customer lands on after paying — success, failure, or still
 * pending. It reads the order back FROM THE SERVER rather than trusting
 * anything passed through the URL, so it always shows the real payment state.
 */
export const Route = createFileRoute("/order-status/$orderId")({
  component: OrderStatusPage,
});

function OrderStatusPage() {
  const { orderId } = Route.useParams();
  const { customer, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);

  async function load() {
    try {
      const res = await api<{ order: Order }>(
        `/api/account/orders?id=${encodeURIComponent(orderId)}`,
      );
      setOrder(res.order);
      return res.order;
    } catch {
      setOrder(null);
      return null;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!customer) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer, orderId]);

  // A pending payment is usually settled by the webhook moments later, so poll
  // briefly rather than leaving the customer staring at "processing".
  useEffect(() => {
    if (!order || order.paymentStatus !== "Pending" || order.paymentMethod !== "Pay Online") return;

    let attempts = 0;
    const timer = setInterval(async () => {
      attempts++;
      const next = await load();
      if (attempts >= 10 || (next && next.paymentStatus !== "Pending")) clearInterval(timer);
    }, 3000);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.paymentStatus, order?.paymentMethod]);

  async function retry() {
    setRetrying(true);
    try {
      const result = await payForOrder(orderId);
      if (result.status === "Paid") toast.success("Payment successful.");
      else if (result.status === "Cancelled") toast.message("Payment cancelled.");
      else if (result.status !== "Pending") toast.error(result.message);
      await load();
    } finally {
      setRetrying(false);
    }
  }

  if (authLoading || loading) {
    return (
      <Shell>
        <div className="flex justify-center py-28">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      </Shell>
    );
  }

  if (!customer) {
    void navigate({ to: "/account/login", search: { redirect: `/order-status/${orderId}` } });
    return null;
  }

  if (!order) {
    return (
      <Shell>
        <div className="container-x py-24 text-center">
          <h1 className="font-serif text-2xl text-foreground">We could not find that order</h1>
          <Link
            to="/account/orders"
            className="mt-6 inline-flex h-11 items-center rounded-full bg-primary px-8 text-xs font-medium uppercase tracking-[0.18em] text-primary-foreground"
          >
            View My Orders
          </Link>
        </div>
      </Shell>
    );
  }

  const paid = order.paymentStatus === "Paid";
  const pending = order.paymentStatus === "Pending";
  const showroom = order.paymentMethod === "Pay at Showroom";

  return (
    <Shell>
      <div className="container-x max-w-3xl py-12 md:py-16">
        {/* ------------------------------------------------------- banner */}
        <div className="text-center">
          <div
            className={cn(
              "mx-auto flex h-16 w-16 items-center justify-center rounded-full",
              paid || showroom ? "bg-primary/15" : pending ? "bg-secondary" : "bg-destructive/10",
            )}
          >
            {paid || showroom ? (
              <CheckCircle2 className="h-8 w-8 text-gold-dark" />
            ) : pending ? (
              <Clock className="h-8 w-8 text-primary" />
            ) : (
              <AlertCircle className="h-8 w-8 text-destructive" />
            )}
          </div>

          <h1 className="mt-6 font-serif text-3xl text-foreground md:text-4xl">
            {paid
              ? "Thank you for your order"
              : showroom
                ? "Your order is reserved"
                : pending
                  ? "Your payment is being confirmed"
                  : "Payment could not be completed"}
          </h1>

          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
            {paid
              ? "We have received your payment. Our team will prepare your piece with care and keep you updated at every step."
              : showroom
                ? "We have reserved your piece. Please visit us at Haldharvas or Khatlal to complete payment and collect it."
                : pending
                  ? "This can take a moment. The page updates by itself — please do not pay again."
                  : order.payment?.failureReason
                    ? order.payment.failureReason
                    : "No money has been taken. You can try again below."}
          </p>

          <GoldRule className="mx-auto mt-7 max-w-xs" />
        </div>

        {/* -------------------------------------------------------- facts */}
        <dl className="mt-9 grid gap-4 rounded-xl border border-border bg-card p-6 sm:grid-cols-2">
          <Fact label="Order ID" value={order.id} mono />
          <Fact label="Amount" value={formatMoney(order.total)} />
          <Fact
            label="Payment status"
            value={order.paymentStatus}
            tone={paid ? "good" : pending ? "muted" : "bad"}
          />
          <Fact label="Payment method" value={order.paymentMethod} />
          {order.payment?.razorpayPaymentId && (
            <Fact label="Payment reference" value={order.payment.razorpayPaymentId} mono />
          )}
          <Fact label="Order status" value={order.status} />
        </dl>

        {/* ----------------------------------------------------- products */}
        <section className="mt-6 rounded-xl border border-border bg-card p-6">
          <h2 className="font-serif text-lg text-foreground">Your pieces</h2>
          <ul className="mt-4 divide-y divide-border">
            {order.items.map((item) => (
              <li key={item.productId} className="flex gap-4 py-3 first:pt-0 last:pb-0">
                <img
                  src={item.image}
                  alt={item.name}
                  className="h-16 w-16 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{item.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.code}
                    {item.purity ? ` · ${item.purity}` : ""}
                    {item.weightGrams ? ` · ${item.weightGrams} g` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatMoney(item.price)} × {item.qty}
                  </p>
                </div>
                <p className="text-sm text-foreground">{formatMoney(item.price * item.qty)}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* ---------------------------------------------------- delivery */}
        <section className="mt-6 rounded-xl border border-border bg-card p-6">
          <h2 className="font-serif text-lg text-foreground">Delivery</h2>
          <address className="mt-3 text-sm not-italic leading-relaxed text-muted-foreground">
            <span className="text-foreground">{order.address.fullName}</span>
            <br />
            {order.address.street}, {order.address.area}
            <br />
            {order.address.city}, {order.address.state} — {order.address.pincode}
            <br />
            +91 {order.address.phone}
          </address>
          <p className="mt-4 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
            {paid
              ? "We will share tracking details as soon as your order is dispatched."
              : "Delivery begins once payment is confirmed."}
          </p>
        </section>

        {/* ----------------------------------------------------- actions */}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {paid || showroom || pending ? (
            <Link
              to="/account/orders/$orderId"
              params={{ orderId: order.id }}
              className="inline-flex h-12 items-center rounded-full bg-primary px-9 text-xs font-medium uppercase tracking-[0.18em] text-primary-foreground"
            >
              View My Order
            </Link>
          ) : (
            <>
              <button
                onClick={() => void retry()}
                disabled={retrying}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-primary px-9 text-xs font-medium uppercase tracking-[0.18em] text-primary-foreground disabled:opacity-50"
              >
                {retrying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                {retrying ? "Opening" : "Retry Payment"}
              </button>
              <Link
                to="/cart"
                className="inline-flex h-12 items-center gap-2 rounded-full border border-border px-8 text-xs font-medium uppercase tracking-[0.14em] text-foreground/80"
              >
                <ShoppingBag className="h-4 w-4" /> Return to Cart
              </Link>
            </>
          )}
        </div>

        <div className="mt-8 text-center">
          <a
            href={`https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(
              `Hello RAS Jewellers, I need help with my order ${order.id}.`,
            )}`}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-2 hover:text-gold-dark hover:underline"
          >
            <MessageCircle className="h-3.5 w-3.5" /> Need help with this order?
          </a>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AnnouncementBar />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

function Fact({
  label,
  value,
  mono,
  tone = "default",
}: {
  label: string;
  value: string;
  mono?: boolean;
  tone?: "default" | "good" | "bad" | "muted";
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "mt-1 break-words text-sm",
          mono && "font-mono text-xs",
          tone === "good" && "font-medium text-gold-dark",
          tone === "bad" && "font-medium text-destructive",
          tone === "muted" && "text-muted-foreground",
          tone === "default" && "text-foreground",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
