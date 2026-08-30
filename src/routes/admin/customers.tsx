import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import { Empty, Input, Money, PageHeader, Spinner, Table } from "@/components/admin/admin-ui";
import { api } from "@/lib/api";
import type { CustomerSummary } from "@/lib/server/admin-queries";

export const Route = createFileRoute("/admin/customers")({
  component: CustomersPage,
});

function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  useEffect(() => {
    api<{ customers: CustomerSummary[] }>("/api/admin/customers")
      .then((res) => setCustomers(res.customers))
      .catch(() => setCustomers([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => [c.name, c.email, c.phone].join(" ").toLowerCase().includes(q));
  }, [customers, query]);

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle={`${customers.length} registered · passwords are never visible to anyone, admins included`}
      />

      <div className="mb-4 max-w-sm">
        <Input
          label="Search"
          value={query}
          onChange={setQuery}
          placeholder="Name, email or mobile"
        />
      </div>

      {filtered.length === 0 ? (
        <Empty
          message={
            customers.length === 0 ? "No customers have registered yet." : "No customers match."
          }
        />
      ) : (
        <Table head={["Customer", "Email", "Mobile", "Registered", "Orders", "Total spent"]}>
          {filtered.map((c) => (
            <tr key={c.id} className="hover:bg-secondary/40">
              <td className="px-4 py-2.5 text-xs text-foreground">{c.name}</td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">{c.email}</td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">+91 {c.phone}</td>
              <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
                {new Date(c.createdAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </td>
              <td className="px-4 py-2.5 text-xs tabular-nums text-foreground">{c.orderCount}</td>
              <td className="px-4 py-2.5 text-xs">
                <Money value={c.totalSpent} />
              </td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
