import { createFileRoute, Link } from "@tanstack/react-router";
import { AlertTriangle, Minus, MessageCircle, Plus, ShoppingBag, Trash2 } from "lucide-react";

import { AnnouncementBar } from "@/components/site/announcement-bar";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { useCart } from "@/lib/cart-store";
import { formatMoney, GST_RATE } from "@/lib/pricing";
import { SITE } from "@/lib/site-data";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/cart")({
  component: CartPage,
});

function CartPage() {
  const {
    items,
    totals,
    itemCount,
    updateQty,
    removeItem,
    clearCart,
    canCheckout,
    checkoutBlockedReason,
  } = useCart();

  // One enquiry message covering every Price-on-Request piece in the bag.
  const enquiryItems = items.filter((i) => i.product.priceOnRequest);
  const enquiryLink = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(
    [
      "Hello RAS Jewellers, I would like a price for:",
      "",
      ...enquiryItems.map((i) => `• ${i.product.name} (${i.product.code}) x${i.qty}`),
    ].join("\n"),
  )}`;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AnnouncementBar />
      <Header />

      <main className="flex-1 py-12">
        <div className="container-x">
          <header className="mb-8">
            <p className="text-[11px] uppercase tracking-[0.3em] text-primary">Your Selection</p>
            <h1 className="mt-2 font-serif text-3xl text-foreground md:text-4xl">Your Bag</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {itemCount > 0
                ? `${itemCount} item${itemCount > 1 ? "s" : ""} in your bag`
                : "Your bag is currently empty."}
            </p>
          </header>

          {items.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                <ShoppingBag className="h-7 w-7 text-primary" />
              </div>
              <h2 className="mt-5 font-serif text-xl text-foreground">Nothing here yet</h2>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                Explore our collection and add the pieces you love to your bag.
              </p>
              <Link
                to="/shop"
                className="mt-6 rounded-full bg-primary px-8 py-3 text-xs font-medium uppercase tracking-[0.18em] text-primary-foreground"
              >
                Browse Collection
              </Link>
            </div>
          ) : (
            <div className="grid gap-8 lg:grid-cols-3">
              {/* ---------------------------------------------------- lines */}
              <div className="space-y-4 lg:col-span-2">
                {items.map(({ product, qty, lineTotal, stockWarning }) => (
                  <article
                    key={product.id}
                    className={cn(
                      "flex flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row",
                      stockWarning ? "border-destructive/40" : "border-border",
                    )}
                  >
                    <img
                      src={product.image}
                      alt={product.name}
                      className="h-28 w-28 shrink-0 self-center rounded-lg object-cover sm:self-start"
                    />

                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-medium text-foreground">{product.name}</h3>
                          <p className="mt-0.5 text-xs text-muted-foreground">{product.code}</p>

                          {/* Purity and weight show only when recorded. */}
                          {(product.purity || product.weightGrams) && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {[
                                product.purity,
                                product.weightGrams ? `${product.weightGrams} g` : null,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                        </div>

                        <button
                          aria-label={`Remove ${product.name}`}
                          onClick={() => removeItem(product.id)}
                          className="shrink-0 text-muted-foreground transition-colors hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>

                      {stockWarning && (
                        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-destructive">
                          <AlertTriangle className="h-3.5 w-3.5" /> {stockWarning}
                        </p>
                      )}

                      <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-4">
                        {product.priceOnRequest ? (
                          <a
                            href={`https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(
                              `Hello RAS Jewellers, I would like a price for: ${product.name} (${product.code}) x${qty}.`,
                            )}`}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="inline-flex items-center gap-1.5 rounded-full border border-gold-dark/40 px-4 py-2 text-xs font-medium uppercase tracking-wide text-gold-dark transition-colors hover:bg-gold-dark hover:text-primary-foreground"
                          >
                            <MessageCircle className="h-3.5 w-3.5" /> Enquire on WhatsApp
                          </a>
                        ) : (
                          <div className="flex items-center gap-2 rounded-full border border-border">
                            <button
                              aria-label="Decrease quantity"
                              onClick={() => updateQty(product.id, qty - 1)}
                              className="flex h-9 w-9 items-center justify-center text-foreground/70 transition-colors hover:text-gold-dark"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            <span className="w-5 text-center text-sm tabular-nums">{qty}</span>
                            <button
                              aria-label="Increase quantity"
                              onClick={() => updateQty(product.id, qty + 1)}
                              disabled={product.stock !== undefined && qty >= product.stock}
                              className="flex h-9 w-9 items-center justify-center text-foreground/70 transition-colors hover:text-gold-dark disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        )}

                        <div className="text-right">
                          {product.priceOnRequest || product.price === undefined ? (
                            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                              Price on Request
                            </p>
                          ) : (
                            <>
                              <p className="text-xs text-muted-foreground">
                                {formatMoney(product.price)} each
                              </p>
                              <p className="font-serif text-lg text-foreground">
                                {formatMoney(lineTotal ?? 0)}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                ))}

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <Link
                    to="/shop"
                    className="text-xs font-medium uppercase tracking-[0.12em] text-gold-dark hover:underline"
                  >
                    ← Continue Shopping
                  </Link>
                  <button
                    onClick={clearCart}
                    className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                  >
                    Clear bag
                  </button>
                </div>
              </div>

              {/* -------------------------------------------------- summary */}
              <aside className="h-fit rounded-xl border border-border bg-card p-6 lg:sticky lg:top-28">
                <h2 className="font-serif text-xl text-foreground">Order Summary</h2>

                <dl className="mt-5 space-y-2.5 text-sm">
                  <Row label="Subtotal" value={formatMoney(totals.subtotal)} />
                  <Row
                    label={`GST (${(GST_RATE * 100).toFixed(0)}%)`}
                    value={formatMoney(totals.gst)}
                  />
                  <Row
                    label="Shipping"
                    value={totals.shipping === 0 ? "Free" : formatMoney(totals.shipping)}
                  />
                  <div className="flex items-baseline justify-between border-t border-border pt-3">
                    <dt className="text-sm font-medium text-foreground">Grand Total</dt>
                    <dd className="font-serif text-2xl text-foreground">
                      {formatMoney(totals.total)}
                    </dd>
                  </div>
                </dl>

                {totals.priceOnRequestCount > 0 && (
                  <div className="mt-5 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4">
                    <p className="text-xs leading-relaxed text-foreground">
                      {totals.priceOnRequestCount} item
                      {totals.priceOnRequestCount > 1 ? "s are" : " is"} priced on request and{" "}
                      {totals.priceOnRequestCount > 1 ? "are" : "is"} not included in the total
                      above.
                    </p>
                    <a
                      href={enquiryLink}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-3 flex items-center justify-center gap-1.5 rounded-full bg-gold-dark px-4 py-2.5 text-xs font-medium uppercase tracking-[0.14em] text-primary-foreground"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> Enquire on WhatsApp
                    </a>
                  </div>
                )}

                {canCheckout ? (
                  <Link
                    to="/checkout"
                    className="mt-6 flex h-12 w-full items-center justify-center rounded-full bg-primary text-xs font-medium uppercase tracking-[0.18em] text-primary-foreground transition-all hover:brightness-[1.04]"
                  >
                    Proceed to Checkout
                  </Link>
                ) : (
                  <button
                    disabled
                    className="mt-6 flex h-12 w-full cursor-not-allowed items-center justify-center rounded-full bg-primary text-xs font-medium uppercase tracking-[0.18em] text-primary-foreground opacity-50"
                  >
                    Proceed to Checkout
                  </button>
                )}

                {checkoutBlockedReason && (
                  <p className="mt-3 text-center text-xs leading-relaxed text-muted-foreground">
                    {checkoutBlockedReason}
                  </p>
                )}

                <p className="mt-5 text-center text-[11px] leading-relaxed text-muted-foreground">
                  Prices vary with daily gold &amp; silver rates and making charges. Our team
                  confirms the final price before dispatch.
                </p>
              </aside>
            </div>
          )}
        </div>
      </main>

      <Footer />
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
