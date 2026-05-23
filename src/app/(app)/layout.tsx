import { AppPrewarm } from "@/components/ui/app-prewarm";
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
    <div className="font-hand-app bg-border/40 font-[family-name:var(--font-hand)]">
      <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-hidden bg-background pb-[6.75rem] shadow-sm">
        <div
          className="app-paper-bg paper-grain-coarse pointer-events-none absolute inset-0 z-0"
          aria-hidden
        />
        <div className="relative z-10 flex flex-1 flex-col">
          <PageTransition>{children}</PageTransition>
        </div>
      </div>
      <BottomNav />
      <ServiceWorkerRegister />
      <InstallPrompt />
      <AppPrewarm />
    </div>
  );
}
