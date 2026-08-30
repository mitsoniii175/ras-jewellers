import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { AuthCard } from "@/components/account/auth-card";
import { FormError, PasswordField, SubmitButton, TextField } from "@/components/account/form";
import { AccountApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";

export const Route = createFileRoute("/account/login")({
  // `redirect` is set by RequireAuth so we can return the customer to the page
  // they originally asked for. Only same-site paths are honoured (see below).
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search.redirect === "string" ? { redirect: search.redirect } : {},
  component: LoginPage,
});

/** Refuse absolute URLs and protocol-relative paths — an open redirect is a
 *  phishing tool, so only in-app paths are allowed. */
function safeRedirect(target: string | undefined): string {
  if (!target || !target.startsWith("/") || target.startsWith("//")) return "/account";
  return target;
}

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }

    setBusy(true);
    try {
      await login(email, password);
      await navigate({ to: safeRedirect(redirect), replace: true });
    } catch (err) {
      setError(
        err instanceof AccountApiError ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard
      eyebrow="Welcome back"
      title="Log in"
      subtitle="Access your orders, saved addresses and wishlist."
      footer={
        <>
          New to RAS Jewellers?{" "}
          <Link to="/account/signup" className="font-medium text-gold-dark hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <TextField
          label="Email address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          autoFocus
        />

        <div>
          <PasswordField
            label="Password"
            value={password}
            onValueChange={setPassword}
            autoComplete="current-password"
          />
          <div className="mt-2 text-right">
            <Link
              to="/account/forgot-password"
              className="text-xs text-muted-foreground underline-offset-2 hover:text-gold-dark hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <FormError message={error} />

        <SubmitButton busy={busy}>{busy ? "Logging in" : "Log in"}</SubmitButton>
      </form>
    </AuthCard>
  );
}
