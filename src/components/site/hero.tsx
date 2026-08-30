import hero from "@/assets/hero.jpg";

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      <img
        src={hero}
        alt="RAS Jewellers gold and diamond necklace"
        width={1600}
        height={900}
        className="h-[420px] w-full object-cover md:h-[560px]"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-cream/90 via-cream/40 to-transparent" />
      <div className="absolute inset-0">
        <div className="container-x flex h-full flex-col justify-center">
          <div className="max-w-xl">
            <p className="mb-3 text-xs font-medium uppercase tracking-[0.35em] text-gold-dark">
              Online Gold Jewellery in Gujarat
            </p>
            <h1 className="font-serif text-4xl leading-tight text-foreground md:text-6xl">
              Timeless Gold,
              <br />
              Crafted with Trust
            </h1>
            <p className="mt-4 max-w-md text-sm text-muted-foreground md:text-base">
              Discover BIS hallmarked 22K &amp; 24K gold, diamond and 925 silver jewellery —
              handcrafted for every celebration.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="#trending"
                className="rounded-full bg-primary px-7 py-3 text-sm font-medium text-primary-foreground transition-transform hover:scale-[1.03]"
              >
                Shop Collection
              </a>
              <a
                href="#services"
                className="rounded-full border border-gold-dark px-7 py-3 text-sm font-medium text-gold-dark transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                Book a Visit
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
