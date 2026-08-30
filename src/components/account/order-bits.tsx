import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  ORDER_STATUSES,
  type OrderStatus,
  type PaymentStatus,
  type TrackingEvent,
} from "@/lib/server/types";

/* Presentation helpers for My Orders. Note the type-only import above: it is
   erased at build time, so nothing from the server module is bundled here. */

export function money(value: number): string {
  return `₹ ${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function orderDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function statusIndex(status: OrderStatus): number {
  // Cancelled/Returned sit outside the ladder — no step is "current".
  return (ORDER_STATUSES as readonly string[]).indexOf(status);
}

export function StatusPill({ status }: { status: OrderStatus }) {
  const delivered = status === "Delivered";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.1em]",
        delivered
          ? "bg-primary/15 text-gold-dark"
          : "border border-border bg-secondary text-secondary-foreground",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          delivered ? "bg-primary" : "bg-muted-foreground/50",
        )}
      />
      {status}
    </span>
  );
}

export function PaymentPill({ status }: { status: PaymentStatus }) {
  const tone =
    status === "Paid"
      ? "text-gold-dark"
      : status === "Failed"
        ? "text-destructive"
        : "text-muted-foreground";
  return <span className={cn("text-xs font-medium", tone)}>{status}</span>;
}

/**
 * Vertical progress through the seven order states. Completed steps carry a
 * gold tick; the current step is ringed; later steps stay quiet.
 */
export function OrderTimeline({
  status,
  events = [],
}: {
  status: OrderStatus;
  events?: TrackingEvent[];
}) {
  const current = statusIndex(status);
  const eventFor = (s: OrderStatus) => events.find((e) => e.status === s);

  return (
    <ol className="relative space-y-0">
      {ORDER_STATUSES.map((step, i) => {
        const done = i < current;
        const active = i === current;
        const event = eventFor(step);
        const last = i === ORDER_STATUSES.length - 1;

        return (
          <li key={step} className="flex gap-4 pb-6 last:pb-0">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                  done && "border-primary bg-primary text-primary-foreground",
                  active && "border-primary bg-background ring-4 ring-primary/15",
                  !done && !active && "border-border bg-background",
                )}
              >
                {done ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <span
                    className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-primary" : "bg-border")}
                  />
                )}
              </span>
              {!last && (
                <span
                  className={cn("mt-1 w-px flex-1", i < current ? "bg-primary/40" : "bg-border")}
                />
              )}
            </div>

            <div className="-mt-0.5 pb-1">
              <p
                className={cn(
                  "text-sm",
                  done || active ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {step}
              </p>
              {event && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {orderDate(event.at)}
                  {event.note ? ` · ${event.note}` : ""}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
