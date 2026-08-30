import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { X } from "lucide-react";
import { toast } from "sonner";

import {
  Badge,
  Button,
  Empty,
  ErrorNote,
  Input,
  Money,
  PageHeader,
  Select,
  Spinner,
  Table,
} from "@/components/admin/admin-ui";
import { useAdmin } from "@/lib/admin-store";
import { AccountApiError, api } from "@/lib/api";
import {
  ORDER_STATUSES,
  TERMINAL_STATUSES,
  type Order,
  type OrderStatus,
} from "@/lib/server/types";

export const Route = createFileRoute("/admin/orders")({
  validateSearch: (search: Record<string, unknown>): { id?: string } => ({
    id: typeof search.id === "string" ? search.id : undefined,
  }),
  component: OrdersPage,
});

type AdminOrder = Order & {
  customer: { id: string; name: string; email: string; phone: string } | null;
};

function OrdersPage() {
  const { id } = Route.useSearch();
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(id ?? null);

  const [query, setQuery] = useState("");
  const [payment, setPayment] = useState("all");
  const [status, setStatus] = useState("all");

  async function load() {
    try {
      const res = await api<{ orders: AdminOrder[] }>("/api/admin/orders");
      setOrders(res.orders);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (payment !== "all" && o.paymentStatus !== payment) return false;
      if (status !== "all" && o.status !== status) return false;
      if (!q) return true;
      return [o.id, o.customer?.name, o.customer?.email, o.customer?.phone, o.shipment?.awb]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [orders, query, payment, status]);

  if (loading) return <Spinner />;

  const current = orders.find((o) => o.id === selected) ?? null;

  return (
    <>
      <PageHeader title="Orders" subtitle={`${orders.length} orders`} />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          label="Search"
          value={query}
          onChange={setQuery}
          placeholder="Order ID, customer, AWB…"
        />
        <Select
          label="Payment"
          value={payment}
          onChange={setPayment}
          options={[
            { value: "all", label: "All" },
            ...["Pending", "Paid", "Failed", "Cancelled", "Refunded"].map((s) => ({
              value: s,
              label: s,
            })),
          ]}
        />
        <Select
          label="Order status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "All" },
            ...[...ORDER_STATUSES, ...TERMINAL_STATUSES].map((s) => ({ value: s, label: s })),
          ]}
        />
        <div className="flex items-end">
          <p className="text-xs text-muted-foreground">
            {filtered.length} of {orders.length} shown
          </p>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Empty
          message={
            orders.length === 0
              ? "No orders have been placed yet."
              : "No orders match these filters."
          }
        />
      ) : (
        <Table head={["Order", "Date", "Customer", "Total", "Payment", "Status", "Shipping", ""]}>
          {filtered.map((o) => (
            <tr key={o.id} className="hover:bg-secondary/40">
              <td className="px-4 py-2.5 font-mono text-[11px] text-foreground">{o.id}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
                {new Date(o.placedAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "2-digit",
                })}
              </td>
              <td className="max-w-[160px] px-4 py-2.5">
                <p className="truncate text-xs text-foreground">{o.customer?.name ?? "—"}</p>
                <p className="truncate text-[10px] text-muted-foreground">
                  {o.customer?.phone ?? ""}
                </p>
              </td>
              <td className="px-4 py-2.5 text-xs">
                <Money value={o.total} />
              </td>
              <td className="px-4 py-2.5">
                <Badge
                  tone={
                    o.paymentStatus === "Paid"
                      ? "good"
                      : o.paymentStatus === "Pending"
                        ? "warn"
                        : "bad"
                  }
                >
                  {o.paymentStatus}
                </Badge>
              </td>
              <td className="px-4 py-2.5">
                <Badge tone={o.status === "Cancelled" || o.status === "Returned" ? "bad" : "info"}>
                  {o.status}
                </Badge>
              </td>
              <td className="px-4 py-2.5 font-mono text-[10px] text-muted-foreground">
                {o.shipment?.awb ?? "—"}
              </td>
              <td className="py-2.5 pr-4 text-right">
                <Button variant="ghost" onClick={() => setSelected(o.id)}>
                  Open
                </Button>
              </td>
            </tr>
          ))}
        </Table>
      )}

      {current && (
        <OrderDrawer
          order={current}
          onClose={() => setSelected(null)}
          onChanged={() => {
            void load();
          }}
        />
      )}
    </>
  );
}

function OrderDrawer({
  order,
  onClose,
  onChanged,
}: {
  order: AdminOrder;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { allowed } = useAdmin();
  const [next, setNext] = useState<OrderStatus>(order.status);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const terminal = order.status === "Cancelled" || order.status === "Returned";

  async function update() {
    setError(null);
    setBusy(true);
    try {
      await api("/api/admin/orders", {
        method: "PUT",
        body: { orderId: order.id, status: next, note },
      });
      toast.success(`Order moved to ${next}.`);
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof AccountApiError ? err.message : "Could not update this order.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/30 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-2xl rounded-xl border border-border bg-card shadow-xl">
        <header className="flex items-center justify-between border-b border-border px-5 py-3">
          <div>
            <h2 className="font-mono text-sm text-foreground">{order.id}</h2>
            <p className="text-[11px] text-muted-foreground">
              {new Date(order.placedAt).toLocaleString("en-IN")}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-5 px-5 py-5 text-sm">
          {order.fulfilmentIssue && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              Stock issue: {order.fulfilmentIssue}
            </p>
          )}

          <section className="grid gap-4 sm:grid-cols-2">
            <div>
              <h3 className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Customer
              </h3>
              <p className="text-foreground">{order.customer?.name ?? "—"}</p>
              <p className="text-xs text-muted-foreground">{order.customer?.email}</p>
              <p className="text-xs text-muted-foreground">+91 {order.customer?.phone}</p>
            </div>
            <div>
              <h3 className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Delivery address
              </h3>
              <address className="text-xs not-italic leading-relaxed text-muted-foreground">
                {order.address.fullName}
                <br />
                {order.address.street}, {order.address.area}
                <br />
                {order.address.city}, {order.address.state} — {order.address.pincode}
              </address>
            </div>
          </section>

          <section>
            <h3 className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Items
            </h3>
            <ul className="divide-y divide-border rounded-lg border border-border">
              {order.items.map((item) => (
                <li key={item.productId} className="flex items-center gap-3 px-3 py-2">
                  <img src={item.image} alt="" className="h-9 w-9 rounded object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs text-foreground">{item.name}</span>
                    <span className="block font-mono text-[10px] text-muted-foreground">
                      {item.code} · ×{item.qty}
                    </span>
                  </span>
                  <Money value={item.price * item.qty} />
                </li>
              ))}
            </ul>
          </section>

          <section className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1 text-xs">
              <Row label="Subtotal" value={order.subtotal} />
              <Row label="GST" value={order.gst} />
              <Row label="Shipping" value={order.shipping} />
              <div className="flex justify-between border-t border-border pt-1 text-sm font-medium text-foreground">
                <span>Total</span>
                <Money value={order.total} />
              </div>
            </div>
            <div className="text-xs">
              <h3 className="mb-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Payment &amp; shipping
              </h3>
              <p className="text-muted-foreground">
                {order.paymentMethod} ·{" "}
                <span className="text-foreground">{order.paymentStatus}</span>
              </p>
              {order.payment?.razorpayPaymentId && (
                <p className="font-mono text-[10px] text-muted-foreground">
                  {order.payment.razorpayPaymentId}
                </p>
              )}
              <p className="mt-2 text-muted-foreground">
                {order.shipment?.awb
                  ? `${order.shipment.courier ?? "Courier"} · ${order.shipment.awb}`
                  : "Not dispatched"}
              </p>
            </div>
          </section>

          {allowed("orders.update") && (
            <section className="space-y-3 border-t border-border pt-4">
              <h3 className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Update status
              </h3>
              {terminal ? (
                <p className="text-xs text-muted-foreground">
                  This order is {order.status.toLowerCase()} and can no longer be moved.
                </p>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Select
                      label="New status"
                      value={next}
                      onChange={(v) => setNext(v as OrderStatus)}
                      options={[
                        ...ORDER_STATUSES,
                        ...(allowed("orders.cancel") ? TERMINAL_STATUSES : []),
                      ].map((s) => ({ value: s, label: s }))}
                    />
                    <Input label="Note (optional)" value={note} onChange={setNote} />
                  </div>
                  <ErrorNote message={error} />
                  <Button
                    onClick={() => void update()}
                    busy={busy}
                    disabled={next === order.status}
                  >
                    Update order
                  </Button>
                  <p className="text-[10px] text-muted-foreground">
                    Cancelling or returning a paid order puts its stock back automatically.
                  </p>
                </>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-muted-foreground">
      <span>{label}</span>
      <Money value={value} />
    </div>
  );
}
