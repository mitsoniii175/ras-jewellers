import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { passwordStrength } from "@/lib/validation";

/* Form primitives for the account pages. Deliberately plain — the elegance
   comes from spacing and type, not from decoration on every control. */

export function Field({
  label,
  error,
  hint,
  children,
  htmlFor,
}: {
  label: string;
  error?: string;
  hint?: ReactNode;
  children: ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label
        htmlFor={htmlFor}
        className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground"
      >
        {label}
      </Label>
      {children}
      {error ? (
        <p className="text-xs text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  error,
  hint,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: ReactNode }) {
  const generated = useId();
  const id = props.id ?? generated;
  return (
    <Field label={label} error={error} hint={hint} htmlFor={id}>
      <Input
        {...props}
        id={id}
        aria-invalid={error ? true : undefined}
        className={cn("h-11 bg-background", error && "border-destructive", className)}
      />
    </Field>
  );
}

/** Mobile number field with a fixed +91 prefix, digits only. */
export function PhoneField({
  label = "Mobile number",
  value,
  onValueChange,
  error,
  id,
}: {
  label?: string;
  value: string;
  onValueChange: (value: string) => void;
  error?: string;
  id?: string;
}) {
  const generated = useId();
  const fieldId = id ?? generated;
  return (
    <Field label={label} error={error} htmlFor={fieldId}>
      <div
        className={cn(
          "flex h-11 items-center gap-2 rounded-md border border-input bg-background px-3",
          error && "border-destructive",
        )}
      >
        <span className="text-sm text-muted-foreground">+91</span>
        <span className="h-5 w-px bg-border" />
        <Input
          id={fieldId}
          value={value}
          onChange={(e) => onValueChange(e.target.value.replace(/\D/g, "").slice(0, 10))}
          placeholder="98765 43210"
          inputMode="numeric"
          autoComplete="tel-national"
          aria-invalid={error ? true : undefined}
          className="h-9 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
        />
      </div>
    </Field>
  );
}

export function PasswordField({
  label,
  value,
  onValueChange,
  error,
  autoComplete = "current-password",
  showStrength = false,
  id,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  error?: string;
  autoComplete?: string;
  showStrength?: boolean;
  id?: string;
}) {
  const generated = useId();
  const fieldId = id ?? generated;
  const [visible, setVisible] = useState(false);
  const strength = showStrength ? passwordStrength(value) : null;

  return (
    <Field label={label} error={error} htmlFor={fieldId}>
      <div className="relative">
        <Input
          id={fieldId}
          type={visible ? "text" : "password"}
          value={value}
          onChange={(e) => onValueChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          className={cn("h-11 bg-background pr-11", error && "border-destructive")}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-muted-foreground transition-colors hover:text-gold-dark"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>

      {strength && value.length > 0 && (
        <div className="flex items-center gap-2 pt-1">
          <div className="flex flex-1 gap-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className={cn(
                  "h-0.5 flex-1 rounded-full transition-colors",
                  i < strength.score ? "bg-gold" : "bg-border",
                )}
              />
            ))}
          </div>
          <span className="text-[11px] tracking-wide text-muted-foreground">{strength.label}</span>
        </div>
      )}
    </Field>
  );
}

export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-sm text-destructive"
    >
      {message}
    </p>
  );
}

/** Primary action button in the brand's gold, with a built-in busy state. */
export function SubmitButton({
  children,
  busy,
  className,
  ...props
}: InputHTMLAttributes<HTMLButtonElement> & { busy?: boolean; children: ReactNode }) {
  return (
    <button
      {...(props as object)}
      type="submit"
      disabled={busy}
      className={cn(
        "flex h-11 w-full items-center justify-center gap-2 rounded-full bg-primary text-xs font-medium uppercase tracking-[0.18em] text-primary-foreground transition-all",
        "hover:brightness-[1.04] disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
