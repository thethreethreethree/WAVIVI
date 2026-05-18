import { WebFooter } from "@/components/web/web-footer";
import { WebHeader } from "@/components/web/web-header";

/** Public shell for the Travejor partner webapp. */
export default function WebSiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <WebHeader />
      <main className="flex-1">{children}</main>
      <WebFooter />
    </div>
  );
}
