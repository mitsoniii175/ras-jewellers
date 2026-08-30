import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { AuthCard } from "@/components/account/auth-card";
import { FormError, PasswordField, SubmitButton } from "@/components/account/form";
import { AccountApiError, api } from "@/lib/api";
import { validatePassword } from "@/lib/validation";

export const Route = createFileRoute("/account/reset-password")({
  validateSearch: (search: Record<string, unknown>): { token?: string } =>
    typeof search.token === "string" ? { token: search.token } : {},
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirmPassword?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const next: typeof errors = {};
    const invalid = validatePassword(password);
    if (invalid) next.password = invalid;
    if (confirmPassword !== password) next.confirmPassword = "Passwords do not match.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      await api("/api/auth/reset-password", {
        method: "POST",
        body: { token, password, confirmPassword },
      });
      toast.success("Your password has been updated.");
      await navigate({ to: "/account/login", replace: true });
    } catch (err) {
      setFormError(
        err instanceof AccountApiError ? err.message : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <AuthCard eyebrow="Password reset" title="Link not valid">
        <p className="text-center text-sm text-muted-foreground">
          This password reset link is missing or incomplete. Please request a new one.
        </p>
        <div className="mt-6 text-center">
          <Link
            to="/account/forgot-password"
            className="inline-flex h-11 items-center rounded-full bg-primary px-7 text-xs font-medium uppercase tracking-[0.18em] text-primary-foreground"
          >
            Request new link
          </Link>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      eyebrow="Password reset"
      title="Set a new password"
      subtitle="Choose a password you have not used before."
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <PasswordField
          label="New password"
          value={password}
          onValueChange={setPassword}
          error={errors.password}
          autoComplete="new-password"
          showStrength
          id="new-password"
        />
        <PasswordField
          label="Confirm new password"
          value={confirmPassword}
          onValueChange={setConfirmPassword}
          error={errors.confirmPassword}
          autoComplete="new-password"
          id="confirm-new-password"
        />
        <FormError message={formError} />
        <SubmitButton busy={busy}>{busy ? "Updating" : "Update password"}</SubmitButton>
      </form>
    </AuthCard>
  );
}
