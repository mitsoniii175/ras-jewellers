import { useState, type FormEvent } from "react";
import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import {
  BarChart3,
  Boxes,
  Coins,
  LayoutDashboard,
  Loader2,
  LogOut,
  Package,
  ShoppingCart,
  Users,
} from "lucide-react";

import { AdminApiError, AdminProvider, useAdmin } from "@/lib/admin-store";
import type { Permission } from "@/lib/server/admin-types";
import { cn } from "@/lib/utils";

/**
 * Admin shell.
 *
 * More functional than the storefront — dense tables, tight spacing — but it
 * keeps RAS Jewellers' cream/gold palette and serif headings so it reads as the
 * same business, not a bolted-on tool.
 */
export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

const NAV: { to: string; label: string; icon: typeof LayoutDashboard; permission: Permission }[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard.view" },
  { to: "/admin/products", label: "Products", icon: Package, permission: "products.view" },
  { to: "/admin/inventory", label: "Inventory", icon: Boxes, permission: "inventory.view" },
  { to: "/admin/orders", label: "Orders", icon: ShoppingCart, permission: "orders.view" },
  { to: "/admin/customers", label: "Customers", icon: Users, permission: "customers.view" },
  { to: "/admin/rates", label: "Metal Rates", icon: Coins, permission: "rates.view" },
  { to: "/admin/reports", label: "Reports", icon: BarChart3, permission: "reports.view" },
];

function AdminLayout() {
  return (
    <AdminProvider>
      <AdminGate />
    </AdminProvider>
  );
}

function AdminGate() {
  const { admin, loading } = useAdmin();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  // Not signed in: show the login form and nothing else. The dashboard's data
  // is behind server-side permission checks regardless.
  if (!admin) return <AdminLogin />;

  return <AdminChrome />;
}

function AdminLogin() {
  const { login } = useAdmin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof AdminApiError ? err.message : "Could not sign you in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-[11px] uppercase tracking-[0.3em] text-primary">RAS Jewellers</p>
          <h1 className="mt-2 font-serif text-3xl text-foreground">Staff Sign In</h1>
          <p className="mt-2 text-xs text-muted-foreground">
            This area is for showroom staff only.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl border border-border bg-card p-6"
          noValidate
        >
          <div className="space-y-1.5">
            <label htmlFor="admin-email" className="text-xs font-medium text-foreground">
              Email
            </label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="admin-password" className="text-xs font-medium text-foreground">
              Password
            </label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-xs font-medium uppercase tracking-[0.18em] text-primary-foreground disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? "Signing in" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:text-gold-dark hover:underline">
            Back to the shop
          </Link>
        </p>
      </div>
    </div>
  );
}

function AdminChrome() {
  const { admin, logout, allowed } = useAdmin();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-cream/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1400px] items-center gap-4 px-5 py-3">
          <Link to="/admin" className="flex items-baseline gap-2">
            <span className="font-serif text-lg tracking-[0.15em] text-gold-dark">RAS</span>
            <span className="text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
              Admin
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-right sm:block">
              <span className="block text-xs font-medium text-foreground">{admin?.name}</span>
              <span className="block text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {admin?.role}
              </span>
            </span>
            <button
              onClick={() => void logout()}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[11px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:border-primary hover:text-gold-dark"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </div>
        </div>

        {/* Nav — horizontal and scrollable so it works on a tablet or phone. */}
        <nav className="border-t border-border">
          <ul className="mx-auto flex max-w-[1400px] gap-1 overflow-x-auto px-3">
            {NAV.filter((item) => allowed(item.permission)).map((item) => {
              const active =
                item.to === "/admin"
                  ? location.pathname === "/admin"
                  : location.pathname.startsWith(item.to);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className={cn(
                      "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-xs font-medium transition-colors",
                      active
                        ? "border-primary text-gold-dark"
                        : "border-transparent text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <item.icon className="h-3.5 w-3.5" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-[1400px] px-5 py-6">
        <Outlet />
      </main>
    </div>
  );
}
