import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { MessageCircle, Phone } from "lucide-react";
import { AnnouncementBar } from "@/components/site/announcement-bar";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SITE } from "@/lib/site-data";

export const Route = createFileRoute("/enquire")({
  component: EnquiryPage,
});

const INTERESTS = ["Gold Jewellery", "Silver Jewellery", "Men's Jewellery", "Bridal / Wedding", "Other"];

function EnquiryPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [interest, setInterest] = useState(INTERESTS[0]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (name.trim().length < 2) {
      setError("Please enter your name.");
      return;
    }
    const digits = phone.replace(/\D/g, "");
    if (digits.length !== 10) {
      setError("Please enter a valid 10-digit mobile number.");
      return;
    }

    const lines = [
      "Hello RAS Jewellers, I have an enquiry:",
      "",
      `Name: ${name.trim()}`,
      `Phone: +91 ${digits}`,
      `Interested in: ${interest}`,
      message.trim() ? `Message: ${message.trim()}` : null,
    ].filter(Boolean);

    const url = `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(lines.join("\n"))}`;
    window.open(url, "_blank", "noreferrer noopener");
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AnnouncementBar />
      <Header />
      <main className="flex-1 py-14">
        <div className="container-x">
          <div className="mx-auto max-w-lg">
            <div className="mb-8 text-center">
              <h1 className="font-serif text-3xl">Send an Enquiry</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Tell us what you're looking for — we'll get back to you with pricing and availability.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border bg-card p-6">
              <div className="space-y-1.5">
                <Label htmlFor="e-name">Full name</Label>
                <Input id="e-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="e-phone">Mobile number</Label>
                <div className="flex items-center gap-2 rounded-md border border-input px-3">
                  <span className="text-sm text-muted-foreground">+91</span>
                  <Input
                    id="e-phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="98765 43210"
                    inputMode="numeric"
                    className="border-0 px-0 shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="e-interest">I'm interested in</Label>
                <select
                  id="e-interest"
                  value={interest}
                  onChange={(e) => setInterest(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {INTERESTS.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="e-message">Message (optional)</Label>
                <textarea
                  id="e-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tell us more — design, weight, budget, occasion..."
                  rows={4}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full">
                <MessageCircle className="h-4 w-4" /> Send via WhatsApp
              </Button>

              <a
                href={`tel:${SITE.phone.replace(/\s/g, "")}`}
                className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                <Phone className="h-3.5 w-3.5" /> Or call us at {SITE.phone}
              </a>
            </form>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
