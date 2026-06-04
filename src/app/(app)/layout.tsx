import { DesignEditor } from "@/components/dev/design-editor";
import { DesignOverridesRuntime } from "@/components/dev/design-overrides-runtime";
import { AppPrewarm } from "@/components/ui/app-prewarm";
import { BottomNav } from "@/components/ui/bottom-nav";
import { DeletionPendingBanner } from "@/components/ui/deletion-pending-banner";
import { PageTransition } from "@/components/ui/page-transition";
import { ThemeProvider } from "@/components/ui/theme-context";
import { ThemeImgSwap } from "@/components/ui/theme-img-swap";
import { ServiceWorkerRegister } from "@/features/pwa";
import { getServerTheme } from "@/lib/theme/server";

/** Mobile app shell — phone-width frame + floating bottom nav.
 *  Note: <OpeningSplash /> is mounted at the top of <body> in the root
 *  layout (not here) so its markup streams to the browser before any
 *  app-shell content — otherwise the shell would briefly paint underneath
 *  before the splash overlay appears. */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const theme = await getServerTheme();
  return (
    <ThemeProvider theme={theme}>
      <div className="font-hand-app bg-border/40 font-[family-name:var(--font-hand)]">
        <div className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-hidden bg-background pb-[6.75rem] shadow-sm">
          <div
            className="app-paper-bg paper-grain-coarse pointer-events-none absolute inset-0 z-0"
            aria-hidden
          />
          <div className="relative z-10 flex flex-1 flex-col">
            {/* Banner appears whenever the signed-in user has a non-null
                deletion_requested_at and the 30-day grace hasn't elapsed.
                Renders nothing otherwise — see component for cost note. */}
            <DeletionPendingBanner />
            <PageTransition>{children}</PageTransition>
          </div>
        </div>
        <BottomNav />
        <ServiceWorkerRegister />
        <ThemeImgSwap />
        <DesignOverridesRuntime />
        <AppPrewarm />
        <DesignEditor />
      </div>
    </ThemeProvider>
  );
}
