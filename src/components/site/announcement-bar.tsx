import { ANNOUNCEMENTS } from "@/lib/site-data";

export function AnnouncementBar() {
  const items = [...ANNOUNCEMENTS, ...ANNOUNCEMENTS];
  return (
    <div className="overflow-hidden bg-primary py-2 text-primary-foreground">
      <div className="flex w-max animate-[marquee_28s_linear_infinite] gap-12 whitespace-nowrap px-6 text-xs tracking-[0.15em] uppercase">
        {items.map((t, i) => (
          <span key={i} className="flex items-center gap-3">
            <span className="opacity-70">◆</span>
            {t}
          </span>
        ))}
      </div>
      <style>{`@keyframes marquee { from { transform: translateX(0); } to { transform: translateX(-50%); } }`}</style>
    </div>
  );
}
