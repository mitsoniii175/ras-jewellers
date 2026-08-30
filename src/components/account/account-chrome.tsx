import { type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Heart, Home, LogOut, MapPin, Package, User } from "lucide-react";

import { useAuth } from "@/lib/auth-store";
import { cn } from "@/lib/utils";

/* Shared chrome for the signed-in account area.

   Styling intent: this is a jewellery house, not a control panel. So — serif
   headings, a gold hairline instead of a heavy sidebar, ivory cards floating
   on the cream page, and plenty of air. No dense tables, no charts, no
   sidebar chrome that looks like an admin tool. */

type AccountLink = {
  to:
    | "/account"
    | "/account/orders"
    | "/account/wishlist"
    | "/account/addresses"
    | "/account/profile";
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Overview must match exactly, or every child route would light it up too. */
  exact?: boolean;
};

const LINKS: AccountLink[] = [
  { to: "/account", label: "Overview", icon: Home, exact: true },
  { to: "/account/orders", label: "My Orders", icon: Package },
  { to: "/account/wishlist", label: "Wishlist", icon: Heart },
  { to: "/account/addresses", label: "Addresses", icon: MapPin },
  { to: "/account/profile", label: "Profile", icon: User },
];

function useIsActive(to: string, exact?: boolean) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const path = pathname.replace(/\/+$/, "") || "/";
  return exact ? path === to : path === to || path.startsWith(`${to}/`);
}

function NavItem({ to, label, icon: Icon, exact }: AccountLink) {
  const active = useIsActive(to, exact);
  return (
    <Link
      to={to}
      className={cn(
        "flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-full px-4 py-2.5 text-sm transition-colors",
        "lg:rounded-none lg:border-l-2 lg:px-4 lg:py-2.5",
        active
          ? "bg-primary/10 font-medium text-gold-dark lg:border-primary lg:bg-transparent"
          : "text-muted-foreground hover:text-gold-dark lg:border-transparent lg:hover:border-border",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}

/** Ornamental rule that echoes the ◆ in the site's announcement bar. */
export function GoldRule({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)} aria-hidden>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-primary/30" />
      <span className="text-[10px] text-primary/60">◆</span>
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-primary/30" />
    </div>
  );
}

export function AccountHeading({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-serif text-3xl text-foreground md:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/** Ivory card used for every block inside the account area. */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border bg-card p-6 shadow-[0_1px_2px_rgba(80,60,30,0.04),0_8px_24px_-12px_rgba(80,60,30,0.10)] md:p-8",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
        <Icon className="h-7 w-7 text-primary" />
      </div>
      <h3 className="mt-5 font-serif text-xl text-foreground">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/**
 * The signed-in account frame: a greeting, a quiet nav rail on desktop that
 * becomes a scrollable pill row on mobile, and the page content.
 */
export function AccountFrame({ children }: { children: ReactNode }) {
  const { customer, logout } = useAuth();
  const navigate = useNavigate();
  const firstName = customer?.name.split(" ")[0] ?? "";

  async function handleLogout() {
    // Leave the account area FIRST. Clearing the session while a guarded page
    // is still mounted lets RequireAuth fire its own redirect to the login
    // screen, which would beat this one and strand the customer there.
    await navigate({ to: "/", replace: true });
    await logout();
  }

  return (
    <div className="container-x py-10 md:py-14">
      <header className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.3em] text-primary">My Account</p>
        <h2 className="mt-2 font-serif text-2xl text-foreground md:text-3xl">
          Namaste, <span className="text-gold-dark">{firstName}</span>
        </h2>
        <GoldRule className="mt-5" />
      </header>

      <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-12">
        {/* Mobile: horizontal pills. Desktop: quiet vertical rail. */}
        <nav
          aria-label="Account"
          className="-mx-5 mb-8 flex gap-2 overflow-x-auto px-5 pb-2 lg:mx-0 lg:mb-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: "none" }}
        >
          {LINKS.map((link) => (
            <NavItem key={link.to} {...link} />
          ))}

          <button
            onClick={() => void handleLogout()}
            className="flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-full px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:text-destructive lg:mt-4 lg:rounded-none lg:border-l-2 lg:border-transparent lg:pt-4"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Log out
          </button>
        </nav>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
