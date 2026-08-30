import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { MailCheck } from "lucide-react";

import { AuthCard } from "@/components/account/auth-card";
import { FormError, SubmitButton, TextField } from "@/components/account/form";
import { AccountApiError, api } from "@/lib/api";
import { validateEmail } from "@/lib/validation";

export const Route = createFileRoute("/account/forgot-password")({
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<{ message: string; devLink?: string } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const invalid = validateEmail(email);
    if (invalid) {
      setError(invalid);
      return;
    }

    setBusy(true);
    try {
      const res = await api<{ message: string; devLink?: string }>("/api/auth/forgot-password", {
        method: "POST",
        body: { email },
      });
      setSent(res);
    } catch (err) {
      setError(
        err instanceof AccountApiError ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <AuthCard
        eyebrow="Password reset"
        title="Check your inbox"
        footer={
          <Link to="/account/login" className="font-medium text-gold-dark hover:underline">
            Back to log in
          </Link>
        }
      >
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-secondary">
            <MailCheck className="h-6 w-6 text-primary" />
          </div>
          <p className="mt-5 text-sm text-muted-foreground">{sent.message}</p>

          {/* Only present when RAS_SHOW_RESET_LINK=1 is set on the server — a
              testing aid for before the email provider is connected. */}
          {sent.devLink && (
            <div className="mt-6 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4 text-left">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-gold-dark">
                Testing mode
              </p>
              <a
                href={sent.devLink}
                className="mt-2 block break-all text-xs text-gold-dark underline"
              >
                {sent.devLink}
              </a>
            </div>
          )}
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      eyebrow="Password reset"
      title="Forgot password?"
      subtitle="Enter the email on your account and we will send you a link to set a new password."
      footer={
        <Link to="/account/login" className="font-medium text-gold-dark hover:underline">
          Back to log in
        </Link>
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
        <FormError message={error} />
        <SubmitButton busy={busy}>{busy ? "Sending" : "Send reset link"}</SubmitButton>
      </form>
    </AuthCard>
  );
}
