import { CATEGORIES } from "@/lib/site-data";
import type { CategorySlug } from "@/lib/catalog";

export function Categories({ onSelect }: { onSelect: (slug: CategorySlug) => void }) {
  return (
    <section className="bg-secondary/50 py-16">
      <div className="container-x">
        <div className="mb-10 text-center">
          <h2 className="font-serif text-3xl md:text-4xl">
            Shop by <span className="text-gold-dark">Category</span>
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Explore our finest handcrafted collections
          </p>
        </div>
        <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-6">
          {CATEGORIES.map((c) => (
            <button key={c.slug} onClick={() => onSelect(c.slug)} className="group text-center">
              <div className="overflow-hidden rounded-full ring-1 ring-border transition-all group-hover:ring-2 group-hover:ring-primary">
                <img
                  src={c.image}
                  alt={c.title}
                  width={300}
                  height={300}
                  loading="lazy"
                  className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-110"
                />
              </div>
              <h3 className="mt-3 font-sans text-sm font-medium">{c.title}</h3>
              <p className="text-xs text-muted-foreground">{c.count} designs</p>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
