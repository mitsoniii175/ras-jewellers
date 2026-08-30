import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Info } from "lucide-react";
import { toast } from "sonner";

import {
  Button,
  Card,
  Empty,
  ErrorNote,
  Input,
  PageHeader,
  Spinner,
  Table,
} from "@/components/admin/admin-ui";
import { useAdmin } from "@/lib/admin-store";
import { AccountApiError, api } from "@/lib/api";
import type { MetalRates } from "@/lib/server/admin-types";

export const Route = createFileRoute("/admin/rates")({
  component: RatesPage,
});

function RatesPage() {
  const { allowed } = useAdmin();
  const [rates, setRates] = useState<MetalRates | null>(null);
  const [history, setHistory] = useState<MetalRates[]>([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({ gold22k: "", gold24k: "", gold18k: "", silver: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await api<{ rates: MetalRates | null; history: MetalRates[] }>(
        "/api/admin/rates",
      );
      setRates(res.rates);
      setHistory(res.history);
      if (res.rates) {
        setForm({
          gold22k: res.rates.gold22k?.toString() ?? "",
          gold24k: res.rates.gold24k?.toString() ?? "",
          gold18k: res.rates.gold18k?.toString() ?? "",
          silver: res.rates.silver?.toString() ?? "",
        });
      }
    } catch {
      setRates(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    setError(null);
    setBusy(true);
    try {
      await api("/api/admin/rates", { method: "PUT", body: form });
      toast.success("Rates updated.");
      await load();
    } catch (err) {
      setError(err instanceof AccountApiError ? err.message : "Could not save the rates.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader title="Metal Rates" subtitle="Shown on the storefront rate banner." />

      {/* Honesty note: these are typed in by hand, not a market feed. */}
      <div className="mb-5 flex gap-2.5 rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-xs leading-relaxed text-foreground">
          These are <strong>manually entered</strong> rates, not a live market feed. The website
          shows them with the date they were last updated and never calls them live. Connecting a
          real rate API later would change that — the architecture already distinguishes the two.
        </p>
      </div>

      {rates && (
        <p className="mb-4 text-xs text-muted-foreground">
          Last updated {new Date(rates.updatedAt).toLocaleString("en-IN")} by {rates.updatedByName}
        </p>
      )}

      {allowed("rates.edit") ? (
        <Card>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              label="22K Gold (₹ / gram)"
              value={form.gold22k}
              onChange={(v) => setForm((f) => ({ ...f, gold22k: v }))}
              type="number"
            />
            <Input
              label="24K Gold (₹ / gram)"
              value={form.gold24k}
              onChange={(v) => setForm((f) => ({ ...f, gold24k: v }))}
              type="number"
            />
            <Input
              label="18K Gold (₹ / gram)"
              value={form.gold18k}
              onChange={(v) => setForm((f) => ({ ...f, gold18k: v }))}
              type="number"
            />
            <Input
              label="Silver (₹ / gram)"
              value={form.silver}
              onChange={(v) => setForm((f) => ({ ...f, silver: v }))}
              type="number"
            />
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Leave a field blank to hide that line on the website.
          </p>
          <div className="mt-4">
            <ErrorNote message={error} />
          </div>
          <div className="mt-3">
            <Button onClick={() => void save()} busy={busy}>
              Save rates
            </Button>
          </div>
        </Card>
      ) : (
        <Card>
          <p className="text-xs text-muted-foreground">You have view-only access to rates.</p>
        </Card>
      )}

      <h2 className="mb-2.5 mt-6 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        History
      </h2>

      {history.length === 0 ? (
        <Empty message="No rates have been recorded yet." />
      ) : (
        <Table head={["When", "22K", "24K", "18K", "Silver", "Updated by"]}>
          {history.slice(0, 60).map((r, i) => (
            <tr key={`${r.updatedAt}-${i}`} className="hover:bg-secondary/40">
              <td className="whitespace-nowrap px-4 py-2.5 text-[11px] text-muted-foreground">
                {new Date(r.updatedAt).toLocaleString("en-IN", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
              <td className="px-4 py-2.5 text-xs tabular-nums text-foreground">
                {r.gold22k ?? "—"}
              </td>
              <td className="px-4 py-2.5 text-xs tabular-nums text-foreground">
                {r.gold24k ?? "—"}
              </td>
              <td className="px-4 py-2.5 text-xs tabular-nums text-foreground">
                {r.gold18k ?? "—"}
              </td>
              <td className="px-4 py-2.5 text-xs tabular-nums text-foreground">
                {r.silver ?? "—"}
              </td>
              <td className="px-4 py-2.5 text-[11px] text-muted-foreground">{r.updatedByName}</td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
