import { GlowOrbs } from "@/components/web/fx/glow-orbs";
import { WebFooter } from "@/components/web/web-footer";
import { WebHeader } from "@/components/web/web-header";
import { requireAdmin } from "@/lib/toolbox/admin";

/** Public shell for the Travejor partner webapp — cinematic dark identity. */
export default async function WebSiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAdmin } = await requireAdmin();
  return (
    <div className="travejor-web relative flex min-h-dvh flex-col">
      {/* Watercolor backdrop — drifting washes + paper grain */}
      <GlowOrbs />
      <div className="grid-overlay pointer-events-none absolute inset-0" aria-hidden />
      <div className="paper-grain pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative flex min-h-dvh flex-col">
        <WebHeader isAdmin={isAdmin} />
        <main className="flex-1">{children}</main>
        <WebFooter />
      </div>
    </div>
  );
}
