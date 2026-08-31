import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, MapPin, MessageCircle, Navigation, Phone } from "lucide-react";

import { AnnouncementBar } from "@/components/site/announcement-bar";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { ABOUT, SHOWROOMS, SITE } from "@/lib/site-data";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About RAS Jewellers | 25+ Years of Trusted Jewellery in Gujarat" },
      {
        name: "description",
        content:
          "For over 25 years RAS Jewellers has been a symbol of trust, purity and timeless craftsmanship, with showrooms in Haldharvas and Khatlal, Gujarat.",
      },
    ],
  }),
  component: AboutPage,
});

/**
 * The founders photograph, if one has been added.
 *
 * Uses a glob rather than a direct import so the page still builds when the
 * file is not there yet — drop `founders.jpg` into src/assets/ and it appears
 * automatically, with the layout switching to two columns.
 */
const founderPhotos = import.meta.glob("/src/assets/founders.{jpg,jpeg,png,webp}", {
  eager: true,
  import: "default",
}) as Record<string, string>;

const foundersPhoto: string | undefined = Object.values(founderPhotos)[0];

function AboutPage() {
  const hasPhoto = Boolean(foundersPhoto);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AnnouncementBar />
      <Header />

      <main className="flex-1">
        <div className="container-x py-14 md:py-20">
          <header className="text-center">
            <p className="text-[11px] uppercase tracking-[0.3em] text-primary">About Us</p>
            <h1 className="mt-3 font-serif text-3xl text-foreground md:text-[2.75rem] md:leading-tight">
              About {SITE.name}
            </h1>
          </header>

          {/* Photo beside the story on desktop; story alone if no photo yet. */}
          <div
            className={
              hasPhoto
                ? "mt-14 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-16"
                : "mt-14 mx-auto max-w-3xl"
            }
          >
            {hasPhoto && (
              <figure className="lg:sticky lg:top-28">
                <img
                  src={foundersPhoto}
                  alt="The founders of RAS Jewellers"
                  className="w-full rounded-xl object-cover shadow-[0_20px_50px_-24px_rgba(80,60,30,0.45)]"
                />
                <figcaption className="mt-3 text-center text-xs tracking-wide text-muted-foreground">
                  Our Founders
                </figcaption>
              </figure>
            )}

            <div>
              <div className="space-y-5">
                {ABOUT.paragraphs.map((paragraph) => (
                  <p
                    key={paragraph.slice(0, 40)}
                    className="text-sm leading-relaxed text-muted-foreground md:text-[0.95rem] md:leading-[1.75]"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>

              {/* Three facts, pulled from the same data the rest of the site uses. */}
              <dl className="mt-10 grid gap-6 border-t border-border pt-7 sm:grid-cols-3">
                <Fact label="Established" value={ABOUT.established} />
                <Fact
                  label="Showrooms"
                  value={`${SHOWROOMS.length} · ${SHOWROOMS.map((s) => s.name.replace(" Showroom", "")).join(" & ")}`}
                />
                <Fact label="Hallmarking" value="100% BIS · HUID Enabled" />
              </dl>
            </div>
          </div>

          {/* ------------------------------------------------ our promise */}
          <section className="mt-16 rounded-2xl border border-border bg-card px-6 py-10 md:px-12 md:py-12">
            <h2 className="text-center font-serif text-2xl text-foreground">Our Promise</h2>
            <ul className="mx-auto mt-8 grid max-w-2xl gap-x-10 gap-y-4 sm:grid-cols-2">
              {ABOUT.promises.map((promise) => (
                <li
                  key={promise}
                  className="flex items-start gap-2.5 text-sm text-muted-foreground"
                >
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-gold-dark" />
                  {promise}
                </li>
              ))}
            </ul>
          </section>

          {/* -------------------------------------------------- showrooms */}
          <section className="mt-16">
            <div className="text-center">
              <p className="text-[11px] uppercase tracking-[0.3em] text-primary">Visit Us</p>
              <h2 className="mt-3 font-serif text-2xl text-foreground md:text-3xl">
                Our <span className="text-gold-dark">Showrooms</span>
              </h2>
            </div>

            <div className="mx-auto mt-9 grid max-w-3xl gap-5 sm:grid-cols-2">
              {SHOWROOMS.map((showroom) => (
                <article
                  key={showroom.name}
                  className="flex flex-col rounded-xl border border-border bg-card p-6"
                >
                  <MapPin className="h-5 w-5 text-gold-dark" />
                  <h3 className="mt-3 font-serif text-lg text-foreground">{showroom.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{showroom.address}</p>
                  {showroom.hours && (
                    <p className="mt-1 text-xs text-muted-foreground">{showroom.hours}</p>
                  )}

                  {/* The button only appears once a real map link exists — a
                      guessed pin would send customers to the wrong shop. */}
                  {showroom.mapUrl && (
                    <a
                      href={showroom.mapUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-full border border-gold-dark/40 px-5 text-xs font-medium uppercase tracking-[0.12em] text-gold-dark transition-colors hover:bg-gold-dark hover:text-primary-foreground"
                    >
                      <Navigation className="h-3.5 w-3.5" /> Get Directions
                    </a>
                  )}
                </article>
              ))}
            </div>

            <div className="mt-9 flex flex-wrap justify-center gap-3">
              <a
                href={`tel:${SITE.phone.replace(/\s/g, "")}`}
                className="inline-flex h-11 items-center gap-2 rounded-full border border-border px-7 text-xs font-medium uppercase tracking-[0.14em] text-foreground/80 transition-colors hover:border-primary hover:text-gold-dark"
              >
                <Phone className="h-3.5 w-3.5" /> {SITE.phone}
              </a>
              <a
                href={`https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(
                  "Hello RAS Jewellers, I would like to visit your showroom.",
                )}`}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-7 text-xs font-medium uppercase tracking-[0.16em] text-primary-foreground"
              >
                <MessageCircle className="h-3.5 w-3.5" /> Message us
              </a>
              <Link
                to="/shop"
                className="inline-flex h-11 items-center rounded-full border border-gold-dark px-7 text-xs font-medium uppercase tracking-[0.14em] text-gold-dark transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                Browse Collection
              </Link>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="order-2 mt-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </dt>
      <dd className="font-serif text-lg leading-snug text-gold-dark">{value}</dd>
    </div>
  );
}
