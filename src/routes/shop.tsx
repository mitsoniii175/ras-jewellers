import { useMemo, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { SearchX, SlidersHorizontal, X } from "lucide-react";

import { AnnouncementBar } from "@/components/site/announcement-bar";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { ProductCard } from "@/components/site/product-card";
import { CATALOG_CATEGORIES, isInStock, type Product } from "@/lib/catalog";
import { useProducts } from "@/lib/product-overrides";
import { formatMoney } from "@/lib/pricing";
import { searchProducts } from "@/lib/search";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 24;

const SORTS = ["Newest", "Price: Low to High", "Price: High to Low", "Popular"] as const;
type Sort = (typeof SORTS)[number];

export const Route = createFileRoute("/shop")({
  validateSearch: (search: Record<string, unknown>): { q?: string; category?: string } => ({
    q: typeof search.q === "string" && search.q.trim() ? search.q : undefined,
    category: typeof search.category === "string" ? search.category : undefined,
  }),
  component: ShopPage,
});

/** Only offer a filter for values that genuinely exist in the catalogue. */
function distinct<T>(values: (T | undefined)[]): T[] {
  return [...new Set(values.filter((v): v is T => v !== undefined && v !== null))].sort();
}

type Filters = {
  categories: string[];
  metals: string[];
  purities: string[];
  types: string[];
  collections: string[];
  inStockOnly: boolean;
  excludePriceOnRequest: boolean;
  maxPrice?: number;
  maxWeight?: number;
};

const EMPTY_FILTERS: Filters = {
  categories: [],
  metals: [],
  purities: [],
  types: [],
  collections: [],
  inStockOnly: false,
  excludePriceOnRequest: false,
};

function ShopPage() {
  const { q, category } = Route.useSearch();
  const navigate = useNavigate();

  const [filters, setFilters] = useState<Filters>(() =>
    category ? { ...EMPTY_FILTERS, categories: [category] } : EMPTY_FILTERS,
  );
  const [sort, setSort] = useState<Sort>("Newest");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Merged with whatever the admin has published (prices, stock, purity...).
  const catalogue = useProducts();

  // What the catalogue actually offers, so we never show an empty filter group.
  const facets = useMemo(
    () => ({
      metals: distinct(catalogue.map((p) => p.material)),
      purities: distinct(catalogue.map((p) => p.purity)),
      types: distinct(catalogue.map((p) => p.type)),
      collections: distinct(catalogue.map((p) => p.collection)),
      maxPrice: Math.max(0, ...catalogue.map((p) => p.price ?? 0)),
      maxWeight: Math.max(0, ...catalogue.map((p) => p.weightGrams ?? 0)),
    }),
    [catalogue],
  );

  // Search narrows the pool first; filters then apply to those matches.
  const pool = useMemo<Product[]>(
    () => (q ? searchProducts(q, catalogue).map((r) => r.product) : catalogue),
    [q, catalogue],
  );

  const filtered = useMemo(() => {
    const out = pool.filter((p) => {
      if (filters.categories.length && !filters.categories.includes(p.category)) return false;
      if (filters.metals.length && !filters.metals.includes(p.material)) return false;
      if (filters.purities.length && (!p.purity || !filters.purities.includes(p.purity)))
        return false;
      if (filters.types.length && (!p.type || !filters.types.includes(p.type))) return false;
      if (
        filters.collections.length &&
        (!p.collection || !filters.collections.includes(p.collection))
      )
        return false;
      if (filters.inStockOnly && !isInStock(p)) return false;
      if (filters.excludePriceOnRequest && p.priceOnRequest) return false;
      if (filters.maxPrice !== undefined && (p.price ?? 0) > filters.maxPrice) return false;
      if (filters.maxWeight !== undefined && (p.weightGrams ?? 0) > filters.maxWeight) return false;
      return true;
    });

    // Sorting. Pieces without a price sort last on the price sorts rather than
    // being treated as free.
    const sorted = [...out];
    if (sort === "Price: Low to High") {
      sorted.sort((a, b) => (a.price ?? Infinity) - (b.price ?? Infinity));
    } else if (sort === "Price: High to Low") {
      sorted.sort((a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity));
    } else if (sort === "Popular") {
      // No order/view history is recorded yet, so "Popular" falls back to the
      // showroom's own ordering (design number) rather than inventing a rank.
      sorted.sort((a, b) => a.code.localeCompare(b.code));
    } else {
      // Newest: highest design number first.
      sorted.sort((a, b) => b.code.localeCompare(a.code));
    }
    return sorted;
  }, [pool, filters, sort]);

  // Offering "Price: Low to High" while nothing has a price would be a control
  // that silently does nothing. Show the price sorts only once prices exist.
  const availableSorts = useMemo<Sort[]>(
    () => (facets.maxPrice > 0 ? [...SORTS] : SORTS.filter((s) => !s.startsWith("Price:"))),
    [facets.maxPrice],
  );

  const visible = filtered.slice(0, visibleCount);
  const activeCount =
    filters.categories.length +
    filters.metals.length +
    filters.purities.length +
    filters.types.length +
    filters.collections.length +
    (filters.inStockOnly ? 1 : 0) +
    (filters.excludePriceOnRequest ? 1 : 0) +
    (filters.maxPrice !== undefined ? 1 : 0) +
    (filters.maxWeight !== undefined ? 1 : 0);

  function toggle(key: keyof Filters, value: string) {
    setFilters((f) => {
      const list = f[key] as string[];
      return {
        ...f,
        [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
      };
    });
    setVisibleCount(PAGE_SIZE);
  }

  const filterPanel = (
    <div className="space-y-7">
      <FilterGroup title="Category">
        {CATALOG_CATEGORIES.map((c) => (
          <CheckRow
            key={c.slug}
            label={`${c.label} (${c.count})`}
            checked={filters.categories.includes(c.slug)}
            onChange={() => toggle("categories", c.slug)}
          />
        ))}
      </FilterGroup>

      <FilterGroup title="Metal">
        {facets.metals.map((m) => (
          <CheckRow
            key={m}
            label={m.charAt(0).toUpperCase() + m.slice(1)}
            checked={filters.metals.includes(m)}
            onChange={() => toggle("metals", m)}
          />
        ))}
      </FilterGroup>

      {facets.types.length > 0 && (
        <FilterGroup title="Jewellery Type">
          {facets.types.map((t) => (
            <CheckRow
              key={t}
              label={t}
              checked={filters.types.includes(t)}
              onChange={() => toggle("types", t)}
            />
          ))}
        </FilterGroup>
      )}

      {/* Purity, Collection, Price and Weight only appear once that data has
          been recorded against products — an empty filter is worse than none. */}
      {facets.purities.length > 0 && (
        <FilterGroup title="Purity">
          {facets.purities.map((p) => (
            <CheckRow
              key={p}
              label={p}
              checked={filters.purities.includes(p)}
              onChange={() => toggle("purities", p)}
            />
          ))}
        </FilterGroup>
      )}

      {facets.collections.length > 0 && (
        <FilterGroup title="Collection">
          {facets.collections.map((c) => (
            <CheckRow
              key={c}
              label={c}
              checked={filters.collections.includes(c)}
              onChange={() => toggle("collections", c)}
            />
          ))}
        </FilterGroup>
      )}

      {facets.maxPrice > 0 && (
        <FilterGroup title="Price Range">
          <label className="block text-xs text-muted-foreground">
            Up to {formatMoney(filters.maxPrice ?? facets.maxPrice)}
            <input
              type="range"
              min={0}
              max={facets.maxPrice}
              step={1000}
              value={filters.maxPrice ?? facets.maxPrice}
              onChange={(e) => setFilters((f) => ({ ...f, maxPrice: Number(e.target.value) }))}
              className="mt-2 w-full accent-[var(--primary)]"
            />
          </label>
        </FilterGroup>
      )}

      {facets.maxWeight > 0 && (
        <FilterGroup title="Weight">
          <label className="block text-xs text-muted-foreground">
            Up to {(filters.maxWeight ?? facets.maxWeight).toFixed(1)} g
            <input
              type="range"
              min={0}
              max={facets.maxWeight}
              step={0.5}
              value={filters.maxWeight ?? facets.maxWeight}
              onChange={(e) => setFilters((f) => ({ ...f, maxWeight: Number(e.target.value) }))}
              className="mt-2 w-full accent-[var(--primary)]"
            />
          </label>
        </FilterGroup>
      )}

      <FilterGroup title="Availability">
        <CheckRow
          label="In stock only"
          checked={filters.inStockOnly}
          onChange={() => setFilters((f) => ({ ...f, inStockOnly: !f.inStockOnly }))}
        />
        <CheckRow
          label="Hide Price on Request"
          checked={filters.excludePriceOnRequest}
          onChange={() =>
            setFilters((f) => ({ ...f, excludePriceOnRequest: !f.excludePriceOnRequest }))
          }
        />
      </FilterGroup>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AnnouncementBar />
      <Header />

      <main className="flex-1">
        <div className="container-x py-10 md:py-14">
          <header className="mb-8 text-center">
            <p className="text-[11px] uppercase tracking-[0.3em] text-primary">
              {q ? "Search" : "Our Collection"}
            </p>
            <h1 className="mt-2 font-serif text-3xl text-foreground md:text-4xl">
              {q ? (
                <>
                  Results for <span className="text-gold-dark">"{q}"</span>
                </>
              ) : (
                <>
                  Shop the <span className="text-gold-dark">Collection</span>
                </>
              )}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "design" : "designs"}
              {activeCount > 0 && " matching your filters"}
            </p>
            {q && (
              <button
                onClick={() => void navigate({ to: "/shop", search: {} })}
                className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-2 hover:text-gold-dark hover:underline"
              >
                <X className="h-3 w-3" /> Clear search
              </button>
            )}
          </header>

          <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-10">
            {/* Desktop rail */}
            <aside className="hidden lg:block">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="font-serif text-lg text-foreground">Filters</h2>
                {activeCount > 0 && (
                  <button
                    onClick={() => setFilters(EMPTY_FILTERS)}
                    className="text-xs text-muted-foreground hover:text-gold-dark"
                  >
                    Clear all
                  </button>
                )}
              </div>
              {filterPanel}
            </aside>

            <div className="min-w-0">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <button
                  onClick={() => setFiltersOpen((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-xs font-medium uppercase tracking-[0.12em] text-foreground/80 lg:hidden"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Filters{activeCount > 0 ? ` (${activeCount})` : ""}
                </button>

                <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                  Sort
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as Sort)}
                    className="rounded-full border border-border bg-card px-3 py-2 text-xs text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {availableSorts.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {filtersOpen && (
                <div className="mb-8 rounded-xl border border-border bg-card p-5 lg:hidden">
                  {filterPanel}
                  {activeCount > 0 && (
                    <button
                      onClick={() => setFilters(EMPTY_FILTERS)}
                      className="mt-5 text-xs text-muted-foreground hover:text-gold-dark"
                    >
                      Clear all filters
                    </button>
                  )}
                </div>
              )}

              {filtered.length === 0 ? (
                <div className="flex flex-col items-center py-20 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
                    <SearchX className="h-7 w-7 text-primary" />
                  </div>
                  <h2 className="mt-5 font-serif text-xl text-foreground">No products found</h2>
                  <p className="mt-2 max-w-sm text-sm text-muted-foreground">
                    {q
                      ? `We could not find any pieces matching "${q}". Try a category such as Necklaces or Bangles, or a design code like NCK-001.`
                      : "No pieces match the filters you have chosen. Try removing one or two."}
                  </p>
                  {(activeCount > 0 || q) && (
                    <button
                      onClick={() => {
                        setFilters(EMPTY_FILTERS);
                        void navigate({ to: "/shop", search: {} });
                      }}
                      className="mt-6 rounded-full bg-primary px-7 py-2.5 text-xs font-medium uppercase tracking-[0.18em] text-primary-foreground"
                    >
                      Clear everything
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-5 md:grid-cols-3">
                    {visible.map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>

                  {visibleCount < filtered.length && (
                    <div className="mt-10 flex justify-center">
                      <button
                        onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                        className="rounded-full border border-primary px-8 py-2.5 text-xs font-medium uppercase tracking-widest text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
                      >
                        Load More ({filtered.length - visibleCount} more)
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-3.5 w-3.5 rounded border-input accent-[var(--primary)]"
      />
      <span className={cn(checked && "font-medium text-gold-dark")}>{label}</span>
    </label>
  );
}
