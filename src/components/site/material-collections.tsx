import { MATERIAL_COLLECTIONS, type Material } from "@/lib/site-data";

export function MaterialCollections({ onSelect }: { onSelect: (m: Material) => void }) {
  return (
    <section className="container-x py-16">
      <div className="mb-10 text-center">
        <h2 className="font-serif text-3xl md:text-4xl">
          Shop by <span className="text-gold-dark">Metal</span>
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Gold &amp; Silver, curated for every occasion
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {MATERIAL_COLLECTIONS.map((c) => (
          <button
            key={c.material}
            onClick={() => onSelect(c.material)}
            className="group relative overflow-hidden rounded-2xl text-left"
          >
            <img
              src={c.image}
              alt={c.title}
              className="h-72 w-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-6 text-cream">
              <h3 className="font-serif text-2xl">{c.title}</h3>
              <p className="mt-1 max-w-sm text-sm text-cream/85">{c.description}</p>
              <span className="mt-3 inline-block text-xs font-medium uppercase tracking-widest text-gold underline underline-offset-4">
                Explore Collection
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}
