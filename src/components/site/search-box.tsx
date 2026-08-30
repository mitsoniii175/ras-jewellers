import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";

import { useProducts } from "@/lib/product-overrides";
import { searchProducts, suggestFor, type Suggestion } from "@/lib/search";
import { cn } from "@/lib/utils";

/**
 * The header search. Deliberately the same pill-shaped field the header already
 * had — the only additions are a clear button and a suggestions panel.
 *
 * Search runs entirely against the in-memory catalogue, so suggestions appear
 * as fast as the customer types, with no request in flight.
 */
export function SearchBox({
  className,
  autoFocus,
  onNavigate,
}: {
  className?: string;
  autoFocus?: boolean;
  onNavigate?: () => void;
}) {
  const navigate = useNavigate();
  const catalogue = useProducts();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);

  const suggestions = useMemo<Suggestion[]>(
    () => (query.trim().length >= 2 ? suggestFor(query, 6, catalogue) : []),
    [query, catalogue],
  );
  const totalMatches = useMemo(
    () => (query.trim().length >= 2 ? searchProducts(query, catalogue).length : 0),
    [query, catalogue],
  );

  // Close the panel when focus moves elsewhere on the page.
  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function go(nextQuery: string) {
    const trimmed = nextQuery.trim();
    if (!trimmed) return;
    setOpen(false);
    onNavigate?.();
    void navigate({ to: "/shop", search: { q: trimmed } });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (highlighted >= 0 && suggestions[highlighted]) {
      applySuggestion(suggestions[highlighted]);
      return;
    }
    go(query);
  }

  function applySuggestion(suggestion: Suggestion) {
    if (suggestion.kind === "product") {
      setOpen(false);
      onNavigate?.();
      void navigate({ to: "/shop", search: { q: suggestion.product.code } });
    } else {
      setQuery(suggestion.query);
      go(suggestion.query);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showPanel = open && query.trim().length >= 2;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <form
        onSubmit={handleSubmit}
        role="search"
        className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5"
      >
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlighted(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          aria-label="Search jewellery"
          aria-expanded={showPanel}
          placeholder="Search necklaces, bangles, NCK-001…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {query && (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => {
              setQuery("");
              setOpen(false);
            }}
            className="shrink-0 text-muted-foreground transition-colors hover:text-gold-dark"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </form>

      {showPanel && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-border bg-card shadow-[0_16px_40px_-20px_rgba(80,60,30,0.35)]">
          {suggestions.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-sm text-foreground">No pieces match "{query.trim()}"</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Try a category like Necklaces or Bangles, or a design code such as NCK-001.
              </p>
            </div>
          ) : (
            <>
              <ul className="max-h-80 overflow-y-auto py-1">
                {suggestions.map((suggestion, i) =>
                  suggestion.kind === "product" ? (
                    <li key={suggestion.product.id}>
                      <button
                        onMouseEnter={() => setHighlighted(i)}
                        onClick={() => applySuggestion(suggestion)}
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
                          highlighted === i ? "bg-secondary" : "hover:bg-secondary/60",
                        )}
                      >
                        <img
                          src={suggestion.product.image}
                          alt=""
                          loading="lazy"
                          className="h-10 w-10 shrink-0 rounded-md object-cover"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-foreground">
                            {suggestion.product.name}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {suggestion.product.code}
                          </span>
                        </span>
                      </button>
                    </li>
                  ) : (
                    <li key={suggestion.query}>
                      <button
                        onMouseEnter={() => setHighlighted(i)}
                        onClick={() => applySuggestion(suggestion)}
                        className={cn(
                          "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors",
                          highlighted === i ? "bg-secondary" : "hover:bg-secondary/60",
                        )}
                      >
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary">
                          <Search className="h-4 w-4 text-primary" />
                        </span>
                        <span className="min-w-0 flex-1 text-sm text-foreground">
                          {suggestion.label}
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            ({suggestion.count} designs)
                          </span>
                        </span>
                      </button>
                    </li>
                  ),
                )}
              </ul>

              <button
                onClick={() => go(query)}
                className="block w-full border-t border-border bg-secondary/40 px-4 py-2.5 text-center text-xs font-medium uppercase tracking-[0.12em] text-gold-dark transition-colors hover:bg-secondary"
              >
                View all {totalMatches} result{totalMatches === 1 ? "" : "s"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
