import { type ReactNode } from "react";

import { GoldRule } from "@/components/account/account-chrome";
import { SITE } from "@/lib/site-data";

/**
 * The centred card used by login / signup / password-reset.
 * Kept intentionally quiet: one column, a serif title, and the brand's
 * "25+ years" line as reassurance under the fold.
 */
export function AuthCard({
  eyebrow,
  title,
  subtitle,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="container-x py-12 md:py-20">
      <div className="mx-auto w-full max-w-md">
        <div className="text-center">
          <p className="text-[11px] uppercase tracking-[0.3em] text-primary">{eyebrow}</p>
          <h1 className="mt-3 font-serif text-3xl text-foreground md:text-4xl">{title}</h1>
          {subtitle && (
            <p className="mx-auto mt-2.5 max-w-sm text-sm text-muted-foreground">{subtitle}</p>
          )}
          <GoldRule className="mt-7" />
        </div>

        <div className="mt-8 rounded-2xl border border-border bg-card p-6 shadow-[0_1px_2px_rgba(80,60,30,0.04),0_16px_40px_-24px_rgba(80,60,30,0.18)] md:p-8">
          {children}
        </div>

        {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}

        <p className="mt-10 text-center text-[11px] uppercase tracking-[0.22em] text-muted-foreground/70">
          {SITE.established}
        </p>
        <p className="mt-1.5 text-center text-[11px] text-muted-foreground/70">
          Showrooms at Haldharvas &amp; Khatlal
        </p>
      </div>
    </div>
  );
}
