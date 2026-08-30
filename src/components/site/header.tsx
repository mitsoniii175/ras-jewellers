import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Heart, ShoppingBag, User, Facebook, Instagram, Menu, X } from "lucide-react";
import { NAV, SITE } from "@/lib/site-data";
import { useCart } from "@/lib/cart-store";
import { useAuth } from "@/lib/auth-store";
import { useWishlist } from "@/lib/wishlist-store";
import { SearchBox } from "@/components/site/search-box";
import logo from "@/assets/ras-logo.jpg";

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { itemCount } = useCart();
  const { customer } = useAuth();
  const { count: wishlistCount } = useWishlist();

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-cream/95 backdrop-blur">
      <div className="container-x flex items-center gap-4 py-4">
        {/* Logo */}
        <a href="/" className="flex items-center gap-3">
          <img
            src={logo}
            alt="RAS Jewellers logo"
            width={44}
            height={44}
            className="h-11 w-11 rounded-full object-cover ring-1 ring-primary/30"
          />
          <span className="font-serif text-xl font-semibold tracking-[0.2em] text-gold-dark">
            {SITE.name}
          </span>
        </a>

        {/* Search */}
        <SearchBox className="mx-auto hidden w-full max-w-xl md:block" />

        {/* Right */}
        <div className="ml-auto flex items-center gap-1">
          <Link
            to="/account"
            className="hidden items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs font-medium uppercase tracking-wide transition-colors hover:border-primary hover:text-gold-dark sm:flex"
          >
            <User className="h-4 w-4" /> {customer ? customer.name.split(" ")[0] : "Account"}
          </Link>
          <Link
            aria-label="Wishlist"
            to="/account/wishlist"
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-foreground/70 transition-colors hover:text-gold-dark"
          >
            <Heart
              className={`h-5 w-5 ${wishlistCount > 0 ? "fill-gold-dark text-gold-dark" : ""}`}
            />
            {wishlistCount > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-gold-dark text-[10px] font-medium text-primary-foreground">
                {wishlistCount}
              </span>
            )}
          </Link>
          <Link
            aria-label="Cart"
            to="/cart"
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-foreground/70 transition-colors hover:text-gold-dark"
          >
            <ShoppingBag className="h-5 w-5" />
            {itemCount > 0 && (
              <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-gold-dark text-[10px] font-medium text-primary-foreground">
                {itemCount}
              </span>
            )}
          </Link>
          <div className="mx-1 hidden h-6 w-px bg-border lg:block" />
          <div className="hidden items-center gap-2 text-muted-foreground lg:flex">
            <a href="#" aria-label="Facebook" className="transition-colors hover:text-gold-dark">
              <Facebook className="h-4 w-4" />
            </a>
            <a
              href={SITE.instagram}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Instagram"
              className="transition-colors hover:text-gold-dark"
            >
              <Instagram className="h-4 w-4" />
            </a>
          </div>
          <button
            aria-label="Menu"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-full lg:hidden"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile search + menu */}
      {menuOpen && (
        <div className="border-t border-border bg-cream px-4 py-4 lg:hidden">
          <SearchBox className="mb-4" onNavigate={() => setMenuOpen(false)} />
          <ul className="space-y-3">
            <li>
              <Link to="/account" className="text-sm font-medium text-foreground/80">
                {customer ? customer.name.split(" ")[0] : "Account"}
              </Link>
            </li>
            <li>
              <Link to="/account/wishlist" className="text-sm font-medium text-foreground/80">
                Wishlist {wishlistCount > 0 ? `(${wishlistCount})` : ""}
              </Link>
            </li>
            <li>
              <Link to="/cart" className="text-sm font-medium text-foreground/80">
                Your Bag {itemCount > 0 ? `(${itemCount})` : ""}
              </Link>
            </li>
            {NAV.map((n) =>
              n.label === "Enquire" ? (
                <li key={n.label}>
                  <Link to="/enquire" className="text-sm font-medium text-foreground/80">
                    Enquire
                  </Link>
                </li>
              ) : (
                <li key={n.label} className="text-sm font-medium text-foreground/80">
                  {n.label}
                </li>
              ),
            )}
          </ul>
        </div>
      )}

      {/* Nav bar */}
      <nav className="hidden border-t border-border lg:block">
        <ul className="container-x flex items-center justify-center gap-8 py-3">
          {NAV.map((n) =>
            n.label === "Enquire" ? (
              <li key={n.label}>
                <Link
                  to="/enquire"
                  className="text-sm font-medium text-foreground/80 transition-colors hover:text-gold-dark"
                >
                  Enquire
                </Link>
              </li>
            ) : (
              <li key={n.label} className="group relative">
                <button className="text-sm font-medium text-foreground/80 transition-colors group-hover:text-gold-dark">
                  {n.label}
                </button>
                {n.items.length > 0 && (
                  <div className="invisible absolute left-1/2 top-full z-50 mt-2 -translate-x-1/2 rounded-lg border border-border bg-card p-2 opacity-0 shadow-lg transition-all group-hover:visible group-hover:opacity-100">
                    {n.items.map((it) => (
                      <a
                        key={it}
                        href="#trending"
                        className="block whitespace-nowrap rounded px-4 py-2 text-sm text-foreground/70 hover:bg-secondary hover:text-gold-dark"
                      >
                        {it}
                      </a>
                    ))}
                  </div>
                )}
              </li>
            ),
          )}
        </ul>
      </nav>
    </header>
  );
}
