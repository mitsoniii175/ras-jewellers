import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Check, CreditCard, Loader2, Lock, MapPin, Plus, ShoppingBag, Store } from "lucide-react";
import { toast } from "sonner";

import { AnnouncementBar } from "@/components/site/announcement-bar";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { GoldRule } from "@/components/account/account-chrome";
import { Field, FormError, PhoneField, SubmitButton, TextField } from "@/components/account/form";
import { AccountApiError, api } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { useCart } from "@/lib/cart-store";
import { payForOrder } from "@/lib/payment-flow";
import { formatMoney, GST_RATE } from "@/lib/pricing";
import type { Address, Order } from "@/lib/server/types";
import { SITE } from "@/lib/site-data";
import { cn } from "@/lib/utils";
import { digitsOnly, STATES, validateAddress, type AddressInput } from "@/lib/validation";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
});

/** Server-priced order, the only figures ever shown on this page. */
type PricedOrder = {
  items: Order["items"];
  subtotal: number;
  gst: number;
  shipping: number;
  total: number;
};

const EMPTY_ADDRESS: AddressInput = {
  fullName: "",
  phone: "",
  street: "",
  area: "",
  city: "",
  state: "Gujarat",
  pincode: "",
};

function CheckoutPage() {
  const { customer, loading } = useAuth();
  const { items, canCheckout, clearCart } = useCart();
  const navigate = useNavigate();

  const lines = useMemo(() => items.map((i) => ({ productId: i.product.id, qty: i.qty })), [items]);

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [addressId, setAddressId] = useState<string | null>(null);
  const [addingAddress, setAddingAddress] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("Pay Online");

  // One key per visit to this page: a retry after a network error replays the
  // same order instead of creating a duplicate.
  const [idempotencyKey] = useState(() =>
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : String(Date.now()) + Math.random().toString(16).slice(2),
  );

  const [priced, setPriced] = useState<PricedOrder | null>(null);
  const [pricingError, setPricingError] = useState<string | null>(null);
  const [placing, setPlacing] = useState(false);

  // Load the customer's saved addresses and preselect their default.
  useEffect(() => {
    if (!customer) return;
    api<{ addresses: Address[] }>("/api/account/addresses")
      .then((res) => {
        setAddresses(res.addresses);
        const preferred = res.addresses.find((a) => a.isDefault) ?? res.addresses[0];
        setAddressId((current) => current ?? preferred?.id ?? null);
        if (res.addresses.length === 0) setAddingAddress(true);
      })
      .catch(() => setAddresses([]));
  }, [customer]);

  // Ask the server what this bag costs. Nothing on this page is priced by the
  // browser — if the server refuses, we show its reason and stop.
  useEffect(() => {
    if (!customer || lines.length === 0) return;
    let cancelled = false;
    setPricingError(null);

    api<{ order: PricedOrder }>("/api/account/checkout", { method: "POST", body: { lines } })
      .then((res) => {
        if (!cancelled) setPriced(res.order);
      })
      .catch((err) => {
        if (cancelled) return;
        setPriced(null);
        setPricingError(
          err instanceof AccountApiError ? err.message : "We could not price your bag.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [customer, lines]);

  async function placeOrder() {
    if (!addressId) {
      toast.error("Please choose a delivery address.");
      return;
    }
    setPlacing(true);
    try {
      const res = await api<{ order: Order }>("/api/account/checkout", {
        method: "PUT",
        body: { lines, addressId, paymentMethod, idempotencyKey },
      });
      // The server has already emptied the account bag; clear the local mirror
      // too, otherwise the header still shows the pieces that just became an
      // order.
      clearCart();

      // "Pay at Showroom" is done — the order stands, payment happens in
      // person. "Pay Online" continues straight into Razorpay.
      if (paymentMethod !== "Pay Online") {
        toast.success("Your order has been placed.");
        await navigate({
          to: "/order-status/$orderId",
          params: { orderId: res.order.id },
          replace: true,
        });
        return;
      }

      const result = await payForOrder(res.order.id);
      if (result.status === "Paid") toast.success("Payment successful.");
      else if (result.status === "Cancelled") toast.message("Payment cancelled — you can retry.");
      else if (result.status === "Unavailable") toast.error(result.message);

      // Every outcome lands on the status page, which reads the real payment
      // state back from the server rather than trusting this result.
      await navigate({
        to: "/order-status/$orderId",
        params: { orderId: res.order.id },
        replace: true,
      });
    } catch (err) {
      // A 409 here means stock or price moved between review and submit.
      setPricingError(
        err instanceof AccountApiError
          ? err.message
          : "We could not place your order. Please try again.",
      );
      toast.error(err instanceof AccountApiError ? err.message : "Could not place your order.");
    } finally {
      setPlacing(false);
    }
  }

  /* ------------------------------------------------------------- guards -- */

  if (loading) {
    return (
      <Shell>
        <div className="flex justify-center py-24">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      </Shell>
    );
  }

  // Orders live on a customer account (My Orders, saved addresses, tracking),
  // so checkout requires signing in. Guests keep their bag and come straight
  // back here after logging in.
  if (!customer) {
    return (
      <Shell>
        <Centered
          icon={Lock}
          title="Please log in to continue"
          body="Your order, delivery address and tracking are saved to your RAS Jewellers account, so checkout needs you signed in. Your bag will be waiting."
        >
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to="/account/login"
              search={{ redirect: "/checkout" }}
              className="inline-flex h-11 items-center rounded-full bg-primary px-8 text-xs font-medium uppercase tracking-[0.18em] text-primary-foreground"
            >
              Log in
            </Link>
            <Link
              to="/account/signup"
              className="inline-flex h-11 items-center rounded-full border border-border px-8 text-xs font-medium uppercase tracking-[0.14em] text-foreground/80"
            >
              Create account
            </Link>
          </div>
        </Centered>
      </Shell>
    );
  }

  if (items.length === 0) {
    return (
      <Shell>
        <Centered
          icon={ShoppingBag}
          title="Your bag is empty"
          body="Add a piece to your bag to check out."
        >
          <Link
            to="/shop"
            className="inline-flex h-11 items-center rounded-full bg-primary px-8 text-xs font-medium uppercase tracking-[0.18em] text-primary-foreground"
          >
            Browse Collection
          </Link>
        </Centered>
      </Shell>
    );
  }

  if (!canCheckout) {
    return (
      <Shell>
        <Centered
          icon={ShoppingBag}
          title="Your bag needs attention"
          body="Some pieces in your bag cannot be checked out yet — please review them first."
        >
          <Link
            to="/cart"
            className="inline-flex h-11 items-center rounded-full bg-primary px-8 text-xs font-medium uppercase tracking-[0.18em] text-primary-foreground"
          >
            Back to Bag
          </Link>
        </Centered>
      </Shell>
    );
  }

  const selectedAddress = addresses.find((a) => a.id === addressId) ?? null;

  return (
    <Shell>
      <div className="container-x py-10 md:py-14">
        <header className="mb-10 text-center">
          <p className="text-[11px] uppercase tracking-[0.3em] text-primary">Secure Checkout</p>
          <h1 className="mt-2 font-serif text-3xl text-foreground md:text-4xl">
            Complete your order
          </h1>
          <GoldRule className="mx-auto mt-6 max-w-xs" />
        </header>

        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            {/* -------------------------------------------- 1. your details */}
            <Section step={1} title="Your Details" icon={Check}>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <Detail label="Name" value={customer.name} />
                <Detail label="Mobile" value={`+91 ${customer.phone}`} />
                <Detail label="Email" value={customer.email} className="sm:col-span-2" />
              </dl>
              <Link
                to="/account/profile"
                className="mt-4 inline-block text-xs uppercase tracking-[0.12em] text-gold-dark hover:underline"
              >
                Edit details
              </Link>
            </Section>

            {/* ---------------------------------------- 2. delivery address */}
            <Section step={2} title="Delivery Address" icon={MapPin}>
              {addresses.length > 0 && (
                <div className="space-y-3">
                  {addresses.map((address) => (
                    <label
                      key={address.id}
                      className={cn(
                        "flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors",
                        addressId === address.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/40",
                      )}
                    >
                      <input
                        type="radio"
                        name="address"
                        checked={addressId === address.id}
                        onChange={() => setAddressId(address.id)}
                        className="mt-1 h-4 w-4 shrink-0 accent-[var(--primary)]"
                      />
                      <span className="min-w-0 text-sm">
                        <span className="font-medium text-foreground">{address.fullName}</span>
                        {address.isDefault && (
                          <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.1em] text-gold-dark">
                            Default
                          </span>
                        )}
                        <span className="mt-1 block leading-relaxed text-muted-foreground">
                          {address.street}, {address.area}, {address.city}
                          <br />
                          {address.state} — {address.pincode} · +91 {address.phone}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              )}

              {addingAddress ? (
                <NewAddressForm
                  onCancel={addresses.length > 0 ? () => setAddingAddress(false) : undefined}
                  onSaved={(next) => {
                    setAddresses(next);
                    // Select whichever address is newest.
                    setAddressId(next[next.length - 1]?.id ?? null);
                    setAddingAddress(false);
                  }}
                />
              ) : (
                <button
                  onClick={() => setAddingAddress(true)}
                  className="mt-4 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.12em] text-gold-dark hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" /> Add a new address
                </button>
              )}
            </Section>

            {/* ------------------------------------------ 3. order summary */}
            <Section step={3} title="Order Summary" icon={ShoppingBag}>
              {pricingError ? (
                <FormError message={pricingError} />
              ) : !priced ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {priced.items.map((item) => (
                    <li key={item.productId} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                      <img
                        src={item.image}
                        alt={item.name}
                        className="h-20 w-20 shrink-0 rounded-lg object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{item.name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{item.code}</p>
                        {(item.purity || item.weightGrams) && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {[item.purity, item.weightGrams ? `${item.weightGrams} g` : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}
                        <p className="mt-1.5 text-xs text-muted-foreground">
                          {formatMoney(item.price)} × {item.qty}
                        </p>
                      </div>
                      <p className="shrink-0 text-sm font-medium text-foreground">
                        {formatMoney(item.price * item.qty)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* --------------------------------------- 4. payment selection */}
            <Section step={4} title="Payment" icon={CreditCard}>
              <div className="space-y-3">
                <PaymentOption
                  label="Pay Online"
                  description="UPI, cards and net banking."
                  icon={CreditCard}
                  selected={paymentMethod === "Pay Online"}
                  onSelect={() => setPaymentMethod("Pay Online")}
                />
                <PaymentOption
                  label="Pay at Showroom"
                  description="Reserve now and pay when you collect at Haldharvas or Khatlal."
                  icon={Store}
                  selected={paymentMethod === "Pay at Showroom"}
                  onSelect={() => setPaymentMethod("Pay at Showroom")}
                />
              </div>

              {/* Online payment is wired up in the next step of this build. */}
              {paymentMethod === "Pay Online" && (
                <p className="mt-4 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-3 text-xs leading-relaxed text-foreground">
                  Online payment is being connected. Your order will be placed with payment marked
                  Pending, and our team will confirm the amount and share a secure payment link.
                </p>
              )}
            </Section>
          </div>

          {/* ------------------------------------------------ sticky total */}
          <aside className="h-fit rounded-xl border border-border bg-card p-6 lg:sticky lg:top-28">
            <h2 className="font-serif text-xl text-foreground">Total</h2>

            {priced ? (
              <>
                <dl className="mt-5 space-y-2.5 text-sm">
                  <Row label="Subtotal" value={formatMoney(priced.subtotal)} />
                  <Row
                    label={`GST (${(GST_RATE * 100).toFixed(0)}%)`}
                    value={formatMoney(priced.gst)}
                  />
                  <Row
                    label="Shipping"
                    value={priced.shipping === 0 ? "Free" : formatMoney(priced.shipping)}
                  />
                  <div className="flex items-baseline justify-between border-t border-border pt-3">
                    <dt className="text-sm font-medium text-foreground">Grand Total</dt>
                    <dd className="font-serif text-2xl text-foreground">
                      {formatMoney(priced.total)}
                    </dd>
                  </div>
                </dl>
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Calculated and confirmed on our server.
                </p>
              </>
            ) : (
              <p className="mt-5 text-sm text-muted-foreground">Pricing your bag…</p>
            )}

            {selectedAddress && (
              <p className="mt-5 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
                Delivering to <span className="text-foreground">{selectedAddress.fullName}</span>,{" "}
                {selectedAddress.city} — {selectedAddress.pincode}
              </p>
            )}

            <button
              onClick={() => void placeOrder()}
              disabled={!priced || !addressId || placing || Boolean(pricingError)}
              className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-primary text-xs font-medium uppercase tracking-[0.18em] text-primary-foreground transition-all hover:brightness-[1.04] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {placing && <Loader2 className="h-4 w-4 animate-spin" />}
              {placing ? "Placing order" : "Place Order"}
            </button>

            <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
              <Lock className="h-3 w-3" /> Your details are kept private
            </p>

            <Link
              to="/cart"
              className="mt-4 block text-center text-xs text-muted-foreground underline-offset-2 hover:text-gold-dark hover:underline"
            >
              Back to bag
            </Link>

            <p className="mt-6 border-t border-border pt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
              Questions? Call {SITE.phone}
            </p>
          </aside>
        </div>
      </div>
    </Shell>
  );
}

/* ------------------------------------------------------------ fragments -- */

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

function Centered({
  icon: Icon,
  title,
  body,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="container-x flex flex-col items-center py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
        <Icon className="h-7 w-7 text-primary" />
      </div>
      <h1 className="mt-5 font-serif text-2xl text-foreground">{title}</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{body}</p>
      <div className="mt-7">{children}</div>
    </div>
  );
}

function Section({
  step,
  title,
  icon: Icon,
  children,
}: {
  step: number;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-6 md:p-7">
      <div className="mb-5 flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-medium text-gold-dark">
          {step}
        </span>
        <h2 className="font-serif text-xl text-foreground">{title}</h2>
        <Icon className="ml-auto h-4 w-4 text-primary/50" />
      </div>
      {children}
    </section>
  );
}

function Detail({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs uppercase tracking-[0.1em] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-foreground">{value}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums text-foreground">{value}</dd>
    </div>
  );
}

function PaymentOption({
  label,
  description,
  icon: Icon,
  selected,
  onSelect,
}: {
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors",
        selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40",
      )}
    >
      <input
        type="radio"
        name="payment"
        checked={selected}
        onChange={onSelect}
        className="mt-1 h-4 w-4 shrink-0 accent-[var(--primary)]"
      />
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
          {description}
        </span>
      </span>
    </label>
  );
}

/** Inline address capture, so a customer never leaves checkout to add one. */
function NewAddressForm({
  onSaved,
  onCancel,
}: {
  onSaved: (addresses: Address[]) => void;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<AddressInput>(EMPTY_ADDRESS);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof AddressInput) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const found = validateAddress(values);
    setErrors(Object.fromEntries(found.map((f) => [f.field, f.message])));
    if (found.length > 0) return;

    setBusy(true);
    try {
      const res = await api<{ addresses: Address[] }>("/api/account/addresses", {
        method: "POST",
        body: values,
      });
      toast.success("Address saved.");
      onSaved(res.addresses);
    } catch (err) {
      if (err instanceof AccountApiError && err.field) setErrors({ [err.field]: err.message });
      else setFormError(err instanceof AccountApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-5 space-y-5 border-t border-border pt-5" noValidate>
      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          label="Full name"
          value={values.fullName}
          onChange={(e) => set("fullName")(e.target.value)}
          error={errors.fullName}
          autoComplete="name"
        />
        <PhoneField
          value={values.phone}
          onValueChange={set("phone")}
          error={errors.phone}
          id="checkout-phone"
        />
      </div>

      <TextField
        label="House / Flat / Street"
        value={values.street}
        onChange={(e) => set("street")(e.target.value)}
        error={errors.street}
        placeholder="Flat 12, Shanti Residency, MG Road"
        autoComplete="address-line1"
      />

      <TextField
        label="Area"
        value={values.area}
        onChange={(e) => set("area")(e.target.value)}
        error={errors.area}
        placeholder="Locality or landmark"
        autoComplete="address-line2"
      />

      <div className="grid gap-5 sm:grid-cols-3">
        <TextField
          label="City"
          value={values.city}
          onChange={(e) => set("city")(e.target.value)}
          error={errors.city}
          autoComplete="address-level2"
        />

        <Field label="State" error={errors.state} htmlFor="checkout-state">
          <select
            id="checkout-state"
            value={values.state}
            onChange={(e) => set("state")(e.target.value)}
            className={cn(
              "flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
              errors.state && "border-destructive",
            )}
          >
            {STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
        </Field>

        <TextField
          label="PIN code"
          value={values.pincode}
          onChange={(e) => set("pincode")(digitsOnly(e.target.value).slice(0, 6))}
          error={errors.pincode}
          inputMode="numeric"
          placeholder="380001"
          autoComplete="postal-code"
        />
      </div>

      <FormError message={formError} />

      <div className="flex flex-col gap-3 sm:flex-row">
        <SubmitButton busy={busy} className="sm:w-auto sm:px-10">
          {busy ? "Saving" : "Save & use this address"}
        </SubmitButton>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="h-11 rounded-full border border-border px-8 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
