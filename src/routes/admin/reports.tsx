import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { Badge, Empty, Money, PageHeader, Spinner, Table } from "@/components/admin/admin-ui";
import { api } from "@/lib/api";

export const Route = createFileRoute("/admin/reports")({
  component: ReportsPage,
});

type Reports = {
  dailySales: { period: string; orders: number; revenue: number }[];
  monthlySales: { period: string; orders: number; revenue: number }[];
  topProducts: { sku: string; name: string; units: number; revenue: number }[];
  lowStock: { sku: string; name: string; stock: number }[];
  outOfStock: { sku: string; name: string }[];
};

function ReportsPage() {
  const [reports, setReports] = useState<Reports | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ reports: Reports }>("/api/admin/dashboard")
      .then((res) => setReports(res.reports))
      .catch(() => setReports(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (!reports) return <Empty message="Could not load reports." />;

  return (
    <>
      <PageHeader
        title="Reports"
        subtitle="Counted from paid orders only — nothing here is estimated."
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Daily sales (last 30 days with activity)">
          {reports.dailySales.length === 0 ? (
            <Empty message="No paid orders yet." />
          ) : (
            <Table head={["Date", "Orders", "Revenue"]}>
              {reports.dailySales.map((row) => (
                <tr key={row.period} className="hover:bg-secondary/40">
                  <td className="px-4 py-2 text-xs text-foreground">
                    {new Date(row.period).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-4 py-2 text-xs tabular-nums text-muted-foreground">
                    {row.orders}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <Money value={row.revenue} />
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Section>

        <Section title="Monthly sales">
          {reports.monthlySales.length === 0 ? (
            <Empty message="No paid orders yet." />
          ) : (
            <Table head={["Month", "Orders", "Revenue"]}>
              {reports.monthlySales.map((row) => (
                <tr key={row.period} className="hover:bg-secondary/40">
                  <td className="px-4 py-2 text-xs text-foreground">{row.period}</td>
                  <td className="px-4 py-2 text-xs tabular-nums text-muted-foreground">
                    {row.orders}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <Money value={row.revenue} />
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Section>

        <Section title="Top products by units sold">
          {reports.topProducts.length === 0 ? (
            <Empty message="Nothing has sold yet." />
          ) : (
            <Table head={["Product", "SKU", "Units", "Revenue"]}>
              {reports.topProducts.map((row) => (
                <tr key={row.sku} className="hover:bg-secondary/40">
                  <td className="max-w-[200px] truncate px-4 py-2 text-xs text-foreground">
                    {row.name}
                  </td>
                  <td className="px-4 py-2 font-mono text-[11px] text-muted-foreground">
                    {row.sku}
                  </td>
                  <td className="px-4 py-2 text-xs tabular-nums text-foreground">{row.units}</td>
                  <td className="px-4 py-2 text-xs">
                    <Money value={row.revenue} />
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Section>

        <Section title="Stock needing attention">
          {reports.outOfStock.length === 0 && reports.lowStock.length === 0 ? (
            <Empty message="Every tracked piece is comfortably in stock." />
          ) : (
            <Table head={["Product", "SKU", "Stock"]}>
              {reports.outOfStock.map((row) => (
                <tr key={row.sku} className="hover:bg-secondary/40">
                  <td className="max-w-[200px] truncate px-4 py-2 text-xs text-foreground">
                    {row.name}
                  </td>
                  <td className="px-4 py-2 font-mono text-[11px] text-muted-foreground">
                    {row.sku}
                  </td>
                  <td className="px-4 py-2">
                    <Badge tone="bad">Out of stock</Badge>
                  </td>
                </tr>
              ))}
              {reports.lowStock.map((row) => (
                <tr key={row.sku} className="hover:bg-secondary/40">
                  <td className="max-w-[200px] truncate px-4 py-2 text-xs text-foreground">
                    {row.name}
                  </td>
                  <td className="px-4 py-2 font-mono text-[11px] text-muted-foreground">
                    {row.sku}
                  </td>
                  <td className="px-4 py-2">
                    <Badge tone="warn">{row.stock} left</Badge>
                  </td>
                </tr>
              ))}
            </Table>
          )}
        </Section>
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}
