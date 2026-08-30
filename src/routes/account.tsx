import { createFileRoute, Outlet } from "@tanstack/react-router";

import { AnnouncementBar } from "@/components/site/announcement-bar";
import { Header } from "@/components/site/header";
import { Footer } from "@/components/site/footer";

/**
 * Layout route for everything under /account.
 *
 * It only supplies the existing site chrome (announcement bar, header,
 * footer) so the account area sits inside the same frame as the rest of the
 * site. Each child page decides whether it needs a signed-in customer.
 */
export const Route = createFileRoute("/account")({
  component: AccountLayout,
});

function AccountLayout() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <AnnouncementBar />
      <Header />
      {/* Child routes render here — see src/routes/account/*.tsx */}
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
