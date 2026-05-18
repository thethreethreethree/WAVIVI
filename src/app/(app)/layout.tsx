import { BottomNav } from "@/components/ui/bottom-nav";
import { PageTransition } from "@/components/ui/page-transition";
import { InstallPrompt, ServiceWorkerRegister } from "@/features/pwa";

/** Mobile app shell — phone-width frame + floating bottom nav. */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-border/40">
      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col bg-background pb-[5.5rem] shadow-sm">
        <PageTransition>{children}</PageTransition>
      </div>
      <BottomNav />
      <ServiceWorkerRegister />
      <InstallPrompt />
    </div>
  );
}
