import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorNote,
  Input,
  PageHeader,
  Select,
  Spinner,
  Table,
} from "@/components/admin/admin-ui";
import { useAdmin } from "@/lib/admin-store";
import { AccountApiError, api } from "@/lib/api";
import { STOCK_REASONS, type StockMovement } from "@/lib/server/admin-types";

export const Route = createFileRoute("/admin/inventory")({
  component: InventoryPage,
});

function InventoryPage() {
  const { allowed } = useAdmin();
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await api<{ movements: StockMovement[] }>("/api/admin/inventory");
      setMovements(res.movements);
    } catch {
      setMovements([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="Every stock change is recorded here and cannot be edited or deleted."
      />

      {allowed("inventory.adjust") && <AdjustForm onDone={() => void load()} />}

      <h2 className="mb-2.5 mt-6 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        Movement history
      </h2>

      {movements.length === 0 ? (
        <Empty message="No stock movements yet. Set a stock count on a product to begin." />
      ) : (
        <Table head={["When", "Product", "SKU", "Change", "Before", "After", "Reason", "By"]}>
          {movements.map((m) => (
            <tr key={m.id} className="hover:bg-secondary/40">
              <td className="whitespace-nowrap px-4 py-2.5 text-[11px] text-muted-foreground">
                {new Date(m.at).toLocaleString("en-IN", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </td>
              <td className="max-w-[200px] truncate px-4 py-2.5 text-xs text-foreground">
                {m.productName}
              </td>
              <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">{m.sku}</td>
              <td className="px-4 py-2.5 text-xs">
                <span className={m.change > 0 ? "text-gold-dark" : "text-destructive"}>
                  {m.change > 0 ? "+" : ""}
                  {m.change}
                </span>
              </td>
              <td className="px-4 py-2.5 text-xs tabular-nums text-muted-foreground">
                {m.previousStock}
              </td>
              <td className="px-4 py-2.5 text-xs tabular-nums text-foreground">{m.newStock}</td>
              <td className="px-4 py-2.5">
                <Badge
                  tone={m.reason === "Sale" ? "good" : m.reason === "Return" ? "warn" : "neutral"}
                >
                  {m.reason}
                </Badge>
                {m.orderId && (
                  <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">
                    {m.orderId}
                  </span>
                )}
              </td>
              <td className="max-w-[140px] truncate px-4 py-2.5 text-[11px] text-muted-foreground">
                {m.actorName}
              </td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}

function AdjustForm({ onDone }: { onDone: () => void }) {
  const [sku, setSku] = useState("");
  const [change, setChange] = useState("");
  const [reason, setReason] = useState("Restock");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await api<{ newStock: number }>("/api/admin/inventory", {
        method: "POST",
        body: { sku: sku.trim().toUpperCase(), change: Number(change), reason, note },
      });
      toast.success(`${sku.toUpperCase()} is now ${res.newStock} in stock.`);
      setSku("");
      setChange("");
      setNote("");
      onDone();
    } catch (err) {
      setError(err instanceof AccountApiError ? err.message : "Could not adjust stock.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="mb-3 font-serif text-base text-foreground">Adjust stock</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Input label="SKU" value={sku} onChange={setSku} placeholder="NCK-001" />
        <Input
          label="Change"
          value={change}
          onChange={setChange}
          type="number"
          hint="+5 to add, -2 to remove"
        />
        <Select
          label="Reason"
          value={reason}
          onChange={setReason}
          // "Sale" is written automatically by paid orders and is not offered
          // here, so the audit log cannot be muddied with a hand-typed sale.
          options={STOCK_REASONS.filter((r) => r !== "Sale").map((r) => ({ value: r, label: r }))}
        />
        <Input label="Note" value={note} onChange={setNote} />
        <div className="flex items-end">
          <Button onClick={() => void submit()} busy={busy} disabled={!sku || !change}>
            Apply
          </Button>
        </div>
      </div>
      <div className="mt-3">
        <ErrorNote message={error} />
      </div>
    </Card>
  );
}
