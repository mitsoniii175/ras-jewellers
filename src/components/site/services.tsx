import { ShieldCheck, BadgeIndianRupee, Gem, Truck } from "lucide-react";

const items = [
  { icon: ShieldCheck, title: "100% BIS Hallmarked", desc: "Every piece certified & HUID enabled" },
  {
    icon: BadgeIndianRupee,
    title: "Transparent Pricing",
    desc: "Live gold rates, no hidden charges",
  },
  { icon: Gem, title: "Certified Diamonds", desc: "IGI / GIA certified solitaires" },
  { icon: Truck, title: "Safe Home Delivery", desc: "Insured shipping across India" },
];

export function Services() {
  return (
    <section id="services" className="container-x py-14">
      <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
        {items.map((it) => (
          <div
            key={it.title}
            className="flex flex-col items-center rounded-xl border border-border bg-card p-6 text-center"
          >
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-gold-dark">
              <it.icon className="h-7 w-7" />
            </div>
            <h3 className="font-sans text-sm font-semibold">{it.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{it.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
