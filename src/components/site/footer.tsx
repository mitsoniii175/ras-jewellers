import { Facebook, Instagram, Phone, Mail, MapPin } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { SITE, NAV } from "@/lib/site-data";

export function Footer() {
  return (
    <footer className="border-t border-border bg-secondary/60">
      <div className="container-x grid gap-10 py-14 md:grid-cols-4">
        <div>
          <h3 className="font-serif text-xl tracking-[0.15em] text-gold-dark">{SITE.name}</h3>
          <p className="mt-3 text-sm text-muted-foreground">{SITE.established}</p>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            Crafting trust, celebrating traditions and creating timeless memories across Gujarat.
          </p>
          <div className="mt-4 flex gap-3">
            <a
              href={SITE.facebook}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Facebook"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border transition-colors hover:border-primary hover:text-gold-dark"
            >
              <Facebook className="h-4 w-4" />
            </a>
            <a
              href={SITE.instagram}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Instagram"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border transition-colors hover:border-primary hover:text-gold-dark"
            >
              <Instagram className="h-4 w-4" />
            </a>
          </div>
          <a
            href={SITE.instagram}
            target="_blank"
            rel="noreferrer noopener"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-gold-dark hover:underline"
          >
            <Instagram className="h-4 w-4" /> Follow us on Instagram
          </a>
        </div>

        <div>
          <h4 className="font-sans text-sm font-semibold uppercase tracking-wide">Shop</h4>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {NAV.slice(3).map((n) =>
              n.label === "Enquire" ? (
                <li key={n.label}>
                  <Link to="/enquire" className="hover:text-gold-dark">
                    {n.label}
                  </Link>
                </li>
              ) : (
                <li key={n.label}>
                  <a href="#trending" className="hover:text-gold-dark">
                    {n.label}
                  </a>
                </li>
              ),
            )}
          </ul>
        </div>

        <div>
          <h4 className="font-sans text-sm font-semibold uppercase tracking-wide">Showrooms</h4>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-dark" /> Haldharvas Showroom,
              Gujarat
            </li>
            <li className="flex gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gold-dark" /> Khatlal Showroom,
              Gujarat
            </li>
          </ul>
        </div>

        <div>
          <h4 className="font-sans text-sm font-semibold uppercase tracking-wide">Contact</h4>
          <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <Phone className="h-4 w-4 text-gold-dark" /> {SITE.phone}
            </li>
            <li className="flex gap-2">
              <Mail className="h-4 w-4 text-gold-dark" /> {SITE.email}
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {SITE.name}. All rights reserved.
      </div>
    </footer>
  );
}
