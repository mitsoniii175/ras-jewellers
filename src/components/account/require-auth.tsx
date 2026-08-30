import { useEffect, useRef, type ReactNode } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { AccountFrame } from "@/components/account/account-chrome";
import { useAuth } from "@/lib/auth-store";

/**
 * Client-side guard for the account pages.
 *
 * This is a UX guard, not the security boundary: it stops a signed-out visitor
 * from seeing an empty account screen and sends them to the login page with a
 * `redirect` back to where they were heading. The actual protection is on the
 * server — every /api/account/** route resolves the customer from the HttpOnly
 * session cookie and answers 401 without one, so there is no customer data in
 * the page for a guard-bypass to reveal.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { customer, loading } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  // Fire the redirect at most once. The location is read here rather than
  // subscribed to, because navigating changes it — as a reactive dependency it
  // would re-trigger this effect and redirect in a loop.
  const redirected = useRef(false);

  useEffect(() => {
    if (loading || customer || redirected.current) return;
    redirected.current = true;
    void navigate({
      to: "/account/login",
      search: { redirect: router.state.location.href },
      replace: true,
    });
  }, [loading, customer, navigate, router]);

  if (loading) {
    return (
      <div className="container-x flex min-h-[50vh] items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <span className="sr-only">Loading your account…</span>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="container-x flex min-h-[50vh] flex-col items-center justify-center py-20 text-center">
        <p className="font-serif text-xl text-foreground">Please log in to view this page</p>
        <Link
          to="/account/login"
          className="mt-5 rounded-full bg-primary px-7 py-2.5 text-xs font-medium uppercase tracking-[0.18em] text-primary-foreground"
        >
          Log in
        </Link>
      </div>
    );
  }

  return <AccountFrame>{children}</AccountFrame>;
}
