import { useEffect, useMemo, useState } from "react";
import { CATEGORIES, type CategorySlug, type Material } from "@/lib/site-data";
import { useProducts } from "@/lib/product-overrides";
import { ProductCard } from "@/components/site/product-card";

const PAGE_SIZE = 24;

export function Trending({
  materialFilter,
  categoryFilter,
  onCategoryChange,
}: {
  materialFilter: Material | "all";
  categoryFilter: CategorySlug | "all";
  onCategoryChange: (slug: CategorySlug | "all") => void;
}) {
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const catalogue = useProducts();

  useEffect(() => {
    function onSearch(e: Event) {
      setQuery((e as CustomEvent<string>).detail ?? "");
    }
    window.addEventListener("ras-search", onSearch);
    return () => window.removeEventListener("ras-search", onSearch);
  }, []);

  const products = useMemo(() => {
    return catalogue.filter((p) => {
      const matchesMaterial = materialFilter === "all" || p.material === materialFilter;
      const matchesCategory = categoryFilter === "all" || p.category === categoryFilter;
      const matchesQuery =
        query.trim() === "" || p.name.toLowerCase().includes(query.trim().toLowerCase());
      return matchesMaterial && matchesCategory && matchesQuery;
    });
  }, [catalogue, materialFilter, categoryFilter, query]);

  // Reset pagination whenever the active filter/search changes.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [materialFilter, categoryFilter, query]);

  const visibleProducts = products.slice(0, visibleCount);

  return (
    <section id="trending" className="container-x py-16">
      <div className="mb-8 text-center">
        <h2 className="font-serif text-3xl md:text-4xl">
          Our <span className="text-gold-dark">Collection</span>
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {query
            ? `Results for "${query}"`
            : "Real designs from our showroom — enquire for pricing"}
        </p>
      </div>

      <div className="mb-10 flex flex-wrap items-center justify-center gap-2">
        <button
          onClick={() => onCategoryChange("all")}
          className={`rounded-full border px-4 py-1.5 text-xs font-medium uppercase tracking-wide transition-colors ${
            categoryFilter === "all"
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:border-primary hover:text-gold-dark"
          }`}
        >
          All
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.slug}
            onClick={() => onCategoryChange(c.slug)}
            className={`rounded-full border px-4 py-1.5 text-xs font-medium uppercase tracking-wide transition-colors ${
              categoryFilter === c.slug
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:border-primary hover:text-gold-dark"
            }`}
          >
            {c.title}
          </button>
        ))}
      </div>

      {products.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">
          No products match — try a different search.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
            {visibleProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>

          {visibleCount < products.length && (
            <div className="mt-10 flex justify-center">
              <button
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="rounded-full border border-primary px-8 py-2.5 text-xs font-medium uppercase tracking-widest text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                Load More ({products.length - visibleCount} more)
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
