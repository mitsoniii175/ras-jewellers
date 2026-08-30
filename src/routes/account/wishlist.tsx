import { useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, MessageCircle, Trash2 } from "lucide-react";

import { AccountHeading, EmptyState, Panel } from "@/components/account/account-chrome";
import { RequireAuth } from "@/components/account/require-auth";
import { CATALOG } from "@/lib/catalog";
import { SITE } from "@/lib/site-data";
import { useWishlist } from "@/lib/wishlist-store";

export const Route = createFileRoute("/account/wishlist")({
  component: () => (
    <RequireAuth>
      <WishlistPage />
    </RequireAuth>
  ),
});

function whatsappProductLink(name: string, code: string) {
  const message = `Hello RAS Jewellers, I would like to know the price and availability of: ${name} (${code}).`;
  return `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(message)}`;
}

function WishlistPage() {
  const { ids, remove } = useWishlist();

  // The wishlist stores product ids only; the pieces themselves come from the
  // same build-time catalog the rest of the site uses.
  const products = useMemo(() => {
    const byId = new Map(CATALOG.map((p) => [p.id, p]));
    return ids.map((id) => byId.get(id)).filter((p): p is NonNullable<typeof p> => Boolean(p));
  }, [ids]);

  return (
    <div className="space-y-8">
      <AccountHeading
        title="Wishlist"
        subtitle={
          products.length > 0
            ? `${products.length} piece${products.length > 1 ? "s" : ""} saved to your account`
            : undefined
        }
      />

      {products.length === 0 ? (
        <Panel className="p-0 md:p-0">
          <EmptyState
            icon={Heart}
            title="Your wishlist is empty"
            description="Tap the heart on any piece in our collection to save it here. Your wishlist stays with your account, so it is waiting for you on any device."
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
        <div className="grid grid-cols-2 gap-5 md:grid-cols-3">
          {products.map((product) => (
            <article
              key={product.id}
              className="group overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-lg"
            >
              <div className="relative overflow-hidden">
                <img
                  src={product.image}
                  alt={product.name}
                  loading="lazy"
                  className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <button
                  onClick={() => remove(product.id)}
                  aria-label={`Remove ${product.name} from wishlist`}
                  className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-card/90 text-muted-foreground backdrop-blur transition-colors hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="p-4">
                <h3 className="line-clamp-2 min-h-[2.5rem] text-sm font-medium text-foreground">
                  {product.name}
                </h3>
                <p className="mt-1 text-xs text-muted-foreground">{product.code}</p>
                <a
                  href={whatsappProductLink(product.name, product.code)}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="mt-3 flex items-center justify-center gap-1.5 rounded-full border border-gold-dark/40 py-2 text-xs font-medium uppercase tracking-wide text-gold-dark transition-colors hover:bg-gold-dark hover:text-primary-foreground"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Ask price
                </a>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
