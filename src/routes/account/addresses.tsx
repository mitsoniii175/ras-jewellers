import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Loader2, MapPin, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { AccountHeading, EmptyState, Panel } from "@/components/account/account-chrome";
import { Field, FormError, PhoneField, SubmitButton, TextField } from "@/components/account/form";
import { RequireAuth } from "@/components/account/require-auth";
import { AccountApiError, api } from "@/lib/api";
import type { Address } from "@/lib/server/types";
import { cn } from "@/lib/utils";
import { digitsOnly, STATES, validateAddress, type AddressInput } from "@/lib/validation";

export const Route = createFileRoute("/account/addresses")({
  component: () => (
    <RequireAuth>
      <AddressesPage />
    </RequireAuth>
  ),
});

const EMPTY: AddressInput = {
  fullName: "",
  phone: "",
  street: "",
  area: "",
  city: "",
  state: "Gujarat", // both showrooms are in Gujarat, so it is the likely default
  pincode: "",
};

function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Address | "new" | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useEffect(() => {
    api<{ addresses: Address[] }>("/api/account/addresses")
      .then((res) => setAddresses(res.addresses))
      .catch(() => toast.error("Could not load your addresses."))
      .finally(() => setLoading(false));
  }, []);

  async function setDefault(address: Address) {
    setPendingId(address.id);
    try {
      const res = await api<{ addresses: Address[] }>("/api/account/addresses", {
        method: "PUT",
        body: { id: address.id, isDefault: true },
      });
      setAddresses(res.addresses);
      toast.success("Default address updated.");
    } catch {
      toast.error("Could not update the default address.");
    } finally {
      setPendingId(null);
    }
  }

  async function remove(address: Address) {
    if (!window.confirm(`Delete the address for ${address.fullName}?`)) return;
    setPendingId(address.id);
    try {
      const res = await api<{ addresses: Address[] }>(
        `/api/account/addresses?id=${encodeURIComponent(address.id)}`,
        { method: "DELETE" },
      );
      setAddresses(res.addresses);
      toast.success("Address deleted.");
    } catch {
      toast.error("Could not delete that address.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <AccountHeading
        title="Saved addresses"
        subtitle="Where we deliver your pieces."
        action={
          editing === null && (
            <button
              onClick={() => setEditing("new")}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-primary px-6 text-xs font-medium uppercase tracking-[0.14em] text-gold-dark transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              <Plus className="h-4 w-4" /> Add address
            </button>
          )
        }
      />

      {editing !== null && (
        <AddressForm
          address={editing === "new" ? null : editing}
          onCancel={() => setEditing(null)}
          onSaved={(next) => {
            setAddresses(next);
            setEditing(null);
          }}
        />
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : addresses.length === 0 && editing === null ? (
        <Panel className="p-0 md:p-0">
          <EmptyState
            icon={MapPin}
            title="No saved addresses"
            description="Save an address once and it will be ready the next time you order from us."
            action={
              <button
                onClick={() => setEditing("new")}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-7 text-xs font-medium uppercase tracking-[0.18em] text-primary-foreground"
              >
                <Plus className="h-4 w-4" /> Add address
              </button>
            }
          />
        </Panel>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {addresses.map((address) => (
            <article
              key={address.id}
              className={cn(
                "relative rounded-2xl border bg-card p-6 transition-colors",
                address.isDefault ? "border-primary/60" : "border-border",
              )}
            >
              {address.isDefault && (
                <span className="absolute -top-2.5 left-6 inline-flex items-center gap-1 rounded-full bg-primary px-3 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-primary-foreground">
                  <Star className="h-2.5 w-2.5 fill-current" /> Default
                </span>
              )}

              <p className="font-medium text-foreground">{address.fullName}</p>
              <address className="mt-2 text-sm not-italic leading-relaxed text-muted-foreground">
                {address.street}
                <br />
                {address.area}, {address.city}
                <br />
                {address.state} — {address.pincode}
              </address>
              <p className="mt-2 text-sm text-muted-foreground">+91 {address.phone}</p>

              <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border pt-4 text-xs">
                <button
                  onClick={() => setEditing(address)}
                  className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-gold-dark"
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit
                </button>
                {!address.isDefault && (
                  <button
                    onClick={() => void setDefault(address)}
                    disabled={pendingId === address.id}
                    className="inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-gold-dark disabled:opacity-50"
                  >
                    <Star className="h-3.5 w-3.5" /> Set as default
                  </button>
                )}
                <button
                  onClick={() => void remove(address)}
                  disabled={pendingId === address.id}
                  className="ml-auto inline-flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function AddressForm({
  address,
  onCancel,
  onSaved,
}: {
  address: Address | null;
  onCancel: () => void;
  onSaved: (addresses: Address[]) => void;
}) {
  const [values, setValues] = useState<AddressInput>(address ? { ...address } : EMPTY);
  const [makeDefault, setMakeDefault] = useState(address?.isDefault ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof AddressInput) => (value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);

    const found = validateAddress(values);
    setErrors(Object.fromEntries(found.map((f) => [f.field, f.message])));
    if (found.length > 0) return;

    setBusy(true);
    try {
      const res = await api<{ addresses: Address[] }>("/api/account/addresses", {
        method: address ? "PUT" : "POST",
        body: { ...values, id: address?.id, isDefault: makeDefault },
      });
      toast.success(address ? "Address updated." : "Address saved.");
      onSaved(res.addresses);
    } catch (err) {
      if (err instanceof AccountApiError && err.field) setErrors({ [err.field]: err.message });
      else setFormError(err instanceof AccountApiError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="font-serif text-xl text-foreground">
          {address ? "Edit address" : "New address"}
        </h2>
        <button
          onClick={onCancel}
          aria-label="Cancel"
          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            label="Full name"
            value={values.fullName}
            onChange={(e) => set("fullName")(e.target.value)}
            error={errors.fullName}
            autoComplete="name"
          />
          <PhoneField
            value={values.phone}
            onValueChange={set("phone")}
            error={errors.phone}
            id="address-phone"
          />
        </div>

        <TextField
          label="House / Flat / Street"
          value={values.street}
          onChange={(e) => set("street")(e.target.value)}
          error={errors.street}
          placeholder="Flat 12, Shanti Residency, MG Road"
          autoComplete="address-line1"
        />

        <TextField
          label="Area"
          value={values.area}
          onChange={(e) => set("area")(e.target.value)}
          error={errors.area}
          placeholder="Locality or landmark"
          autoComplete="address-line2"
        />

        <div className="grid gap-5 sm:grid-cols-3">
          <TextField
            label="City"
            value={values.city}
            onChange={(e) => set("city")(e.target.value)}
            error={errors.city}
            autoComplete="address-level2"
          />

          <Field label="State" error={errors.state} htmlFor="address-state">
            <select
              id="address-state"
              value={values.state}
              onChange={(e) => set("state")(e.target.value)}
              className={cn(
                "flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
                errors.state && "border-destructive",
              )}
            >
              {STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </Field>

          <TextField
            label="PIN code"
            value={values.pincode}
            onChange={(e) => set("pincode")(digitsOnly(e.target.value).slice(0, 6))}
            error={errors.pincode}
            inputMode="numeric"
            placeholder="380001"
            autoComplete="postal-code"
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={makeDefault}
            onChange={(e) => setMakeDefault(e.target.checked)}
            className="h-4 w-4 rounded border-input accent-[var(--primary)]"
          />
          Use this as my default delivery address
        </label>

        <FormError message={formError} />

        <div className="flex flex-col gap-3 sm:flex-row">
          <SubmitButton busy={busy} className="sm:w-auto sm:px-10">
            {busy ? "Saving" : address ? "Save changes" : "Save address"}
          </SubmitButton>
          <button
            type="button"
            onClick={onCancel}
            className="h-11 rounded-full border border-border px-8 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      </form>
    </Panel>
  );
}
