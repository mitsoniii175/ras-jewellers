import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { AccountHeading, Panel } from "@/components/account/account-chrome";
import {
  FormError,
  PasswordField,
  PhoneField,
  SubmitButton,
  TextField,
} from "@/components/account/form";
import { RequireAuth } from "@/components/account/require-auth";
import { AccountApiError, api } from "@/lib/api";
import { useAuth, type Customer } from "@/lib/auth-store";
import { validateEmail, validateName, validatePassword, validatePhone } from "@/lib/validation";

export const Route = createFileRoute("/account/profile")({
  component: () => (
    <RequireAuth>
      <ProfilePage />
    </RequireAuth>
  ),
});

type Errors = Record<string, string>;

function ProfilePage() {
  const { customer, setCustomer } = useAuth();

  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Keep the form in step with the session once it has loaded.
  useEffect(() => {
    if (!customer) return;
    setName(customer.name);
    setPhone(customer.phone);
    setEmail(customer.email);
  }, [customer]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const next: Errors = {};
    const nameError = validateName(name);
    if (nameError) next.name = nameError;
    const phoneError = validatePhone(phone);
    if (phoneError) next.phone = phoneError;
    const emailError = validateEmail(email);
    if (emailError) next.email = emailError;
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      const res = await api<{ customer: Customer }>("/api/account/profile", {
        method: "PUT",
        body: { name, phone, email },
      });
      setCustomer(res.customer);
      toast.success("Your details have been updated.");
    } catch (err) {
      if (err instanceof AccountApiError && err.field) setErrors({ [err.field]: err.message });
      else setFormError(err instanceof AccountApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <AccountHeading
        title="Profile"
        subtitle="Your personal details, as we have them on record."
      />

      <Panel>
        <form onSubmit={handleSubmit} className="max-w-lg space-y-5" noValidate>
          <TextField
            label="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            autoComplete="name"
          />
          <PhoneField value={phone} onValueChange={setPhone} error={errors.phone} />
          <TextField
            label="Email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            hint="This is the address you log in with."
            autoComplete="email"
          />
          <FormError message={formError} />
          <SubmitButton busy={busy} className="sm:w-auto sm:px-10">
            {busy ? "Saving" : "Save changes"}
          </SubmitButton>
        </form>
      </Panel>

      <ChangePassword />

      {customer && (
        <p className="text-center text-xs text-muted-foreground">
          Member since{" "}
          {new Date(customer.createdAt).toLocaleDateString("en-IN", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      )}
    </div>
  );
}

function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const next: Errors = {};
    if (!currentPassword) next.currentPassword = "Enter your current password.";
    const invalid = validatePassword(newPassword);
    if (invalid) next.newPassword = invalid;
    if (confirmPassword !== newPassword) next.confirmPassword = "Passwords do not match.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      await api("/api/account/profile", {
        method: "PUT",
        body: { currentPassword, newPassword, confirmPassword },
      });
      toast.success("Your password has been changed.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setErrors({});
    } catch (err) {
      if (err instanceof AccountApiError && err.field) setErrors({ [err.field]: err.message });
      else setFormError(err instanceof AccountApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <h2 className="font-serif text-xl text-foreground">Change password</h2>
      <p className="mt-1.5 text-sm text-muted-foreground">
        For your security, confirm your current password before setting a new one.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 max-w-lg space-y-5" noValidate>
        <PasswordField
          label="Current password"
          value={currentPassword}
          onValueChange={setCurrentPassword}
          error={errors.currentPassword}
          autoComplete="current-password"
          id="current-password"
        />
        <PasswordField
          label="New password"
          value={newPassword}
          onValueChange={setNewPassword}
          error={errors.newPassword}
          autoComplete="new-password"
          showStrength
          id="profile-new-password"
        />
        <PasswordField
          label="Confirm new password"
          value={confirmPassword}
          onValueChange={setConfirmPassword}
          error={errors.confirmPassword}
          autoComplete="new-password"
          id="profile-confirm-password"
        />
        <FormError message={formError} />
        <SubmitButton busy={busy} className="sm:w-auto sm:px-10">
          {busy ? "Updating" : "Update password"}
        </SubmitButton>
      </form>
    </Panel>
  );
}
