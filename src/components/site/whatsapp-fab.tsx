import { MessageCircle } from "lucide-react";
import { SITE } from "@/lib/site-data";

export function WhatsappFab() {
  const message =
    "Hello RAS Jewellers, I'd like to know today's price for a piece I'm interested in.";
  const url = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(message)}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      aria-label="Chat with us on WhatsApp"
      className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-white shadow-lg transition-transform hover:scale-105"
    >
      <MessageCircle className="h-7 w-7" fill="currentColor" />
    </a>
  );
}
