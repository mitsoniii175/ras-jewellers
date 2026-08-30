import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Archive, ArchiveRestore, Pencil, X } from "lucide-react";
import { toast } from "sonner";

import {
  Badge,
  Button,
  Empty,
  ErrorNote,
  Input,
  Money,
  PageHeader,
  Select,
  Spinner,
  Table,
} from "@/components/admin/admin-ui";
import { useAdmin } from "@/lib/admin-store";
import { AccountApiError, api } from "@/lib/api";
import { STOCK_REASONS } from "@/lib/server/admin-types";

export const Route = createFileRoute("/admin/products")({
  component: ProductsPage,
});

type AdminProduct = {
  id: string;
  code: string;
  name: string;
  image: string;
  category: string;
  categoryLabel: string;
  material: string;
  purity?: string;
  type?: string;
  collection?: string;
  weightGrams?: number;
  size?: string;
  price?: number;
  makingChargesPct?: number;
  stock?: number;
  priceOnRequest: boolean;
  bisHallmark?: string;
  description?: string;
  videoUrl?: string;
  images?: string[];
  archived?: boolean;
  managed: boolean;
};

type StockFilter = "all" | "in" | "low" | "out" | "untracked";
type PublishFilter = "all" | "published" | "unpublished";

const LOW_STOCK = 3;

function ProductsPage() {
  const { allowed } = useAdmin();
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminProduct | null>(null);

  const [query, setQuery] = useState("");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [publishFilter, setPublishFilter] = useState<PublishFilter>("all");

  async function load() {
    try {
      const res = await api<{ products: AdminProduct[] }>("/api/admin/products");
      setProducts(res.products);
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return products.filter((p) => {
      if (q) {
        const haystack = [p.name, p.code, p.categoryLabel, p.material, p.purity, p.type]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      // "Untracked" is a real, distinct state: no admin has set stock yet, so
      // the piece is neither in nor out of stock.
      const stock = p.managed ? (p.stock ?? 0) : undefined;
      if (stockFilter === "untracked" && stock !== undefined) return false;
      if (stockFilter === "in" && (stock === undefined || stock <= 0)) return false;
      if (stockFilter === "out" && stock !== 0) return false;
      if (stockFilter === "low" && (stock === undefined || stock <= 0 || stock > LOW_STOCK))
        return false;

      if (publishFilter === "published" && p.archived) return false;
      if (publishFilter === "unpublished" && !p.archived) return false;

      return true;
    });
  }, [products, query, stockFilter, publishFilter]);

  if (loading) return <Spinner />;

  return (
    <>
      <PageHeader
        title="Products"
        subtitle={`${products.length} catalogue photos · ${products.filter((p) => p.managed).length} with commercial data`}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Input
          label="Search"
          value={query}
          onChange={setQuery}
          placeholder="Name, SKU, purity, metal…"
        />
        <Select
          label="Stock"
          value={stockFilter}
          onChange={(v) => setStockFilter(v as StockFilter)}
          options={[
            { value: "all", label: "All" },
            { value: "in", label: "In stock" },
            { value: "low", label: `Low (≤ ${LOW_STOCK})` },
            { value: "out", label: "Out of stock" },
            { value: "untracked", label: "Not set up yet" },
          ]}
        />
        <Select
          label="Visibility"
          value={publishFilter}
          onChange={(v) => setPublishFilter(v as PublishFilter)}
          options={[
            { value: "all", label: "All" },
            { value: "published", label: "Live" },
            { value: "unpublished", label: "Archived" },
          ]}
        />
        <div className="flex items-end">
          <p className="text-xs text-muted-foreground">
            {filtered.length} of {products.length} shown
          </p>
        </div>
      </div>

      {filtered.length === 0 ? (
        <Empty message="No products match these filters." />
      ) : (
        <Table head={["", "Product", "SKU", "Purity / Weight", "Price", "Stock", "State", ""]}>
          {filtered.slice(0, 100).map((p) => {
            const stock = p.managed ? (p.stock ?? 0) : undefined;
            return (
              <tr key={p.id} className="hover:bg-secondary/40">
                <td className="py-2 pl-4">
                  <img src={p.image} alt="" className="h-9 w-9 rounded object-cover" />
                </td>
                <td className="max-w-[220px] px-4 py-2">
                  <p className="truncate text-xs text-foreground">{p.name}</p>
                  <p className="truncate text-[10px] text-muted-foreground">{p.categoryLabel}</p>
                </td>
                <td className="px-4 py-2 font-mono text-[11px] text-muted-foreground">{p.code}</td>
                <td className="whitespace-nowrap px-4 py-2 text-xs text-muted-foreground">
                  {[p.purity, p.weightGrams ? `${p.weightGrams} g` : null]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-xs">
                  {p.price === undefined ? (
                    <span className="text-muted-foreground">On request</span>
                  ) : (
                    <Money value={p.price} />
                  )}
                </td>
                <td className="px-4 py-2 text-xs">
                  {stock === undefined ? (
                    <span className="text-muted-foreground">Not tracked</span>
                  ) : stock === 0 ? (
                    <Badge tone="bad">Out</Badge>
                  ) : stock <= LOW_STOCK ? (
                    <Badge tone="warn">{stock} left</Badge>
                  ) : (
                    <span className="tabular-nums text-foreground">{stock}</span>
                  )}
                </td>
                <td className="px-4 py-2">
                  {p.archived ? (
                    <Badge tone="bad">Archived</Badge>
                  ) : (
                    <Badge tone="good">Live</Badge>
                  )}
                </td>
                <td className="py-2 pr-4 text-right">
                  {allowed("products.edit") && (
                    <Button variant="ghost" onClick={() => setEditing(p)}>
                      <Pencil className="h-3 w-3" /> Edit
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </Table>
      )}

      {filtered.length > 100 && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Showing the first 100 — narrow the search to see more.
        </p>
      )}

      {editing && (
        <ProductEditor
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------- editor -- */

function ProductEditor({
  product,
  onClose,
  onSaved,
}: {
  product: AdminProduct;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { allowed } = useAdmin();
  const [form, setForm] = useState({
    name: product.name,
    description: product.description ?? "",
    purity: product.purity ?? "",
    type: product.type ?? "",
    collection: product.collection ?? "",
    weightGrams: product.weightGrams?.toString() ?? "",
    size: product.size ?? "",
    price: product.price?.toString() ?? "",
    makingChargesPct: product.makingChargesPct?.toString() ?? "",
    stock: (product.stock ?? 0).toString(),
    bisHallmark: product.bisHallmark ?? "",
    videoUrl: product.videoUrl ?? "",
    images: (product.images ?? []).join("\n"),
    priceOnRequest: product.priceOnRequest,
    published: !product.archived,
    stockReason: "Manual Adjustment",
    note: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const stockChanged = Number(form.stock) !== (product.stock ?? 0);

  async function save() {
    setError(null);
    setBusy(true);
    try {
      await api("/api/admin/products", {
        method: "PUT",
        body: {
          sku: product.code,
          name: form.name,
          description: form.description,
          purity: form.purity,
          type: form.type,
          collection: form.collection,
          weightGrams: form.weightGrams,
          size: form.size,
          price: form.price === "" ? null : form.price,
          makingChargesPct: form.makingChargesPct,
          stock: form.stock,
          bisHallmark: form.bisHallmark,
          videoUrl: form.videoUrl,
          images: form.images
            .split("\n")
            .map((i) => i.trim())
            .filter(Boolean),
          priceOnRequest: form.priceOnRequest,
          published: form.published,
          stockReason: form.stockReason,
          note: form.note,
        },
      });
      toast.success(`${product.code} saved.`);
      onSaved();
    } catch (err) {
      setError(err instanceof AccountApiError ? err.message : "Could not save this product.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleArchive() {
    setBusy(true);
    try {
      await api(
        `/api/admin/products?sku=${encodeURIComponent(product.code)}&restore=${product.archived ? "true" : "false"}`,
        { method: "DELETE" },
      );
      toast.success(product.archived ? "Product restored." : "Product archived.");
      onSaved();
    } catch (err) {
      setError(err instanceof AccountApiError ? err.message : "Could not update this product.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/30 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-3xl rounded-xl border border-border bg-card shadow-xl">
        <header className="flex items-center gap-3 border-b border-border px-5 py-3">
          <img src={product.image} alt="" className="h-10 w-10 rounded object-cover" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate font-serif text-lg text-foreground">{product.name}</h2>
            <p className="font-mono text-[11px] text-muted-foreground">{product.code}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-5 px-5 py-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="Product name" value={form.name} onChange={set("name")} />
            <Input
              label="Size"
              value={form.size}
              onChange={set("size")}
              placeholder="e.g. 2.6 inch"
            />
          </div>

          <label className="block">
            <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Description
            </span>
            <textarea
              value={form.description}
              onChange={(e) => set("description")(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-2.5 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>

          <div className="grid gap-3 sm:grid-cols-3">
            <Input label="Purity" value={form.purity} onChange={set("purity")} placeholder="22K" />
            <Input
              label="Jewellery type"
              value={form.type}
              onChange={set("type")}
              placeholder="Necklace"
            />
            <Input
              label="Collection"
              value={form.collection}
              onChange={set("collection")}
              placeholder="Bridal"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              label="Weight (grams)"
              value={form.weightGrams}
              onChange={set("weightGrams")}
              type="number"
            />
            <Input
              label="Price (₹)"
              value={form.price}
              onChange={set("price")}
              type="number"
              hint="Leave blank for Price on Request"
            />
            <Input
              label="Making charges (%)"
              value={form.makingChargesPct}
              onChange={set("makingChargesPct")}
              type="number"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              label="Stock"
              value={form.stock}
              onChange={set("stock")}
              type="number"
              hint={stockChanged ? `Changing from ${product.stock ?? 0}` : undefined}
            />
            <Select
              label="Reason for stock change"
              value={form.stockReason}
              onChange={set("stockReason")}
              options={STOCK_REASONS.filter((r) => r !== "Sale").map((r) => ({
                value: r,
                label: r,
              }))}
            />
            <Input label="Note (optional)" value={form.note} onChange={set("note")} />
          </div>

          <Input
            label="BIS / HUID hallmark"
            value={form.bisHallmark}
            onChange={set("bisHallmark")}
            placeholder="HUID AZ1234"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Extra image URLs (one per line)
              </span>
              <textarea
                value={form.images}
                onChange={(e) => set("images")(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-2.5 py-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </label>
            <Input label="Video URL" value={form.videoUrl} onChange={set("videoUrl")} />
          </div>

          <div className="flex flex-wrap gap-5 border-t border-border pt-4">
            <label className="flex items-center gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                checked={form.priceOnRequest}
                onChange={(e) => setForm((f) => ({ ...f, priceOnRequest: e.target.checked }))}
                className="h-3.5 w-3.5 accent-[var(--primary)]"
              />
              Always Price on Request
            </label>
            <label className="flex items-center gap-2 text-xs text-foreground">
              <input
                type="checkbox"
                checked={form.published}
                onChange={(e) => setForm((f) => ({ ...f, published: e.target.checked }))}
                className="h-3.5 w-3.5 accent-[var(--primary)]"
              />
              Published on the website
            </label>
          </div>

          <ErrorNote message={error} />
        </div>

        <footer className="flex flex-wrap items-center gap-2 border-t border-border px-5 py-3">
          <Button onClick={() => void save()} busy={busy}>
            Save product
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>

          {allowed("products.delete") && (
            <Button
              variant="danger"
              onClick={() => void toggleArchive()}
              busy={busy}
              className="ml-auto"
            >
              {product.archived ? (
                <>
                  <ArchiveRestore className="h-3 w-3" /> Restore
                </>
              ) : (
                <>
                  <Archive className="h-3 w-3" /> Archive
                </>
              )}
            </Button>
          )}
        </footer>
      </div>
    </div>
  );
}
