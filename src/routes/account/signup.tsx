import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { AuthCard } from "@/components/account/auth-card";
import {
  FormError,
  PasswordField,
  PhoneField,
  SubmitButton,
  TextField,
} from "@/components/account/form";
import { AccountApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-store";
import { validateEmail, validateName, validatePassword, validatePhone } from "@/lib/validation";

export const Route = createFileRoute("/account/signup")({
  component: SignupPage,
});

type Errors = Partial<Record<"name" | "phone" | "email" | "password" | "confirmPassword", string>>;

function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function validate(): Errors {
    const next: Errors = {};
    const nameError = validateName(name);
    if (nameError) next.name = nameError;
    const phoneError = validatePhone(phone);
    if (phoneError) next.phone = phoneError;
    const emailError = validateEmail(email);
    if (emailError) next.email = emailError;
    const passwordError = validatePassword(password);
    if (passwordError) next.password = passwordError;
    if (password && confirmPassword !== password) next.confirmPassword = "Passwords do not match.";
    return next;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setBusy(true);
    try {
      await signup({ name, phone, email, password, confirmPassword });
      await navigate({ to: "/account", replace: true });
    } catch (err) {
      // The server tells us which field it rejected (e.g. a duplicate email),
      // so the message lands next to the input rather than in a banner.
      if (err instanceof AccountApiError && err.field) {
        setErrors({ [err.field]: err.message } as Errors);
      } else {
        setFormError(
          err instanceof AccountApiError ? err.message : "Something went wrong. Please try again.",
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard
      eyebrow="Join us"
      title="Create your account"
      subtitle="Track your orders, save your favourite pieces and check out faster."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/account/login" className="font-medium text-gold-dark hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <TextField
          label="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          placeholder="Your full name"
          autoComplete="name"
          autoFocus
        />

        <PhoneField value={phone} onValueChange={setPhone} error={errors.phone} />

        <TextField
          label="Email address"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          placeholder="you@example.com"
          autoComplete="email"
        />

        <PasswordField
          label="Password"
          value={password}
          onValueChange={setPassword}
          error={errors.password}
          autoComplete="new-password"
          showStrength
        />

        <PasswordField
          label="Confirm password"
          value={confirmPassword}
          onValueChange={setConfirmPassword}
          error={errors.confirmPassword}
          autoComplete="new-password"
        />

        <FormError message={formError} />

        <SubmitButton busy={busy}>{busy ? "Creating account" : "Create account"}</SubmitButton>

        <p className="text-center text-[11px] leading-relaxed text-muted-foreground">
          We only use your details to process enquiries and orders. Your password is encrypted and
          never stored in readable form.
        </p>
      </form>
    </AuthCard>
  );
}
