import { Heart, MessageCircle, ShoppingBag } from "lucide-react";

import { isInStock, type Product } from "@/lib/catalog";
import { useCart } from "@/lib/cart-store";
import { formatMoney } from "@/lib/pricing";
import { SITE } from "@/lib/site-data";
import { cn } from "@/lib/utils";
import { useWishlist } from "@/lib/wishlist-store";

/**
 * One piece in a grid. Extracted from the homepage Trending section so the shop
 * page, search results and Trending all render a piece identically — the visual
 * treatment is unchanged from what was already on the site.
 */
export function ProductCard({ product }: { product: Product }) {
  const { addItem, qtyOf } = useCart();
  const { has: isWishlisted, toggle: toggleWishlist } = useWishlist();

  const inStock = isInStock(product);
  const inCart = qtyOf(product.id);

  const enquiryLink = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(
    `Hello RAS Jewellers, I would like to know the price and availability of: ${product.name} (${product.code}).`,
  )}`;

  return (
    <article className="group overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-xl">
      <div className="relative overflow-hidden">
        <img
          src={product.image}
          alt={product.name}
          width={600}
          height={600}
          loading="lazy"
          className={cn(
            "aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-105",
            !inStock && "opacity-60",
          )}
        />

        {!inStock && (
          <span className="absolute left-3 top-3 rounded-full bg-foreground/80 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-background">
            Out of Stock
          </span>
        )}

        <button
          aria-label={isWishlisted(product.id) ? "Remove from wishlist" : "Save to wishlist"}
          onClick={() => toggleWishlist(product.id, product.name)}
          className={cn(
            "absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity",
            isWishlisted(product.id) ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
        >
          <Heart className={cn("h-4 w-4", isWishlisted(product.id) && "fill-current")} />
        </button>
      </div>

      <div className="p-4">
        <h3 className="line-clamp-2 min-h-[2.5rem] font-sans text-sm font-medium text-foreground">
          {product.name}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">{product.code}</p>

        {/* Purity / weight only appear once they have actually been recorded. */}
        {(product.purity || product.weightGrams) && (
          <p className="mt-1 text-xs text-muted-foreground">
            {[product.purity, product.weightGrams ? `${product.weightGrams} g` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}

        <p className="mt-2 text-sm font-medium text-foreground">
          {product.priceOnRequest || product.price === undefined ? (
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Price on Request
            </span>
          ) : (
            formatMoney(product.price)
          )}
        </p>

        <div className="mt-3 flex gap-2">
          {product.priceOnRequest || product.price === undefined ? (
            // No price to charge — the only sensible action is an enquiry.
            <a
              href={enquiryLink}
              target="_blank"
              rel="noreferrer noopener"
              className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-gold-dark/40 py-2 text-xs font-medium uppercase tracking-wide text-gold-dark transition-colors hover:bg-gold-dark hover:text-primary-foreground"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Enquire on WhatsApp
            </a>
          ) : (
            <>
              <button
                onClick={() => addItem(product)}
                disabled={!inStock}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-gold-dark/40 py-2 text-xs font-medium uppercase tracking-wide text-gold-dark transition-colors hover:bg-gold-dark hover:text-primary-foreground disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gold-dark"
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                {!inStock ? "Out of Stock" : inCart > 0 ? `In Bag (${inCart})` : "Add to Cart"}
              </button>
              <a
                href={enquiryLink}
                target="_blank"
                rel="noreferrer noopener"
                aria-label="Ask about this piece on WhatsApp"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-foreground/70 transition-colors hover:border-green-600 hover:text-green-600"
              >
                <MessageCircle className="h-4 w-4" />
              </a>
            </>
          )}
        </div>
      </div>
    </article>
  );
}
