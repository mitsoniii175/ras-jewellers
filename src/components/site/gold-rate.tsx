import { RATES } from "@/lib/site-data";

export function GoldRateBanner() {
  const { goldRate22k, goldRate24k, silverRate, updatedOn } = RATES;
  const hasAnyRate = goldRate22k !== null || goldRate24k !== null || silverRate !== null;

  // Nothing filled in yet -> don't show a banner with fake numbers.
  if (!hasAnyRate) {
    return (
      <section className="bg-primary text-primary-foreground">
        <div className="container-x flex flex-col items-center justify-between gap-2 py-6 text-center">
          <p className="text-xs uppercase tracking-[0.3em] opacity-80">Today's Rate</p>
          <p className="font-serif text-lg">Call us for today's gold &amp; silver rates</p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-primary text-primary-foreground">
      <div className="container-x flex flex-col items-center justify-between gap-4 py-6 text-center md:flex-row md:text-left">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] opacity-80">
            {updatedOn ? `Rate as of ${updatedOn}` : "Today's Rate"}
          </p>
          {goldRate22k !== null && (
            <p className="mt-1 font-serif text-2xl">
              22K Gold · ₹ {goldRate22k.toLocaleString("en-IN")} / gram
            </p>
          )}
        </div>
        <div className="flex gap-8">
          {goldRate24k !== null && (
            <div>
              <p className="text-xs uppercase tracking-widest opacity-80">24K Gold</p>
              <p className="font-serif text-xl">₹ {goldRate24k.toLocaleString("en-IN")} /g</p>
            </div>
          )}
          {silverRate !== null && (
            <div>
              <p className="text-xs uppercase tracking-widest opacity-80">Silver</p>
              <p className="font-serif text-xl">₹ {silverRate.toLocaleString("en-IN")} /g</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
