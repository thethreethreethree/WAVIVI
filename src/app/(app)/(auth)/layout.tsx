import Image from "next/image";
import Link from "next/link";

import { siteConfig } from "@/config/site";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link
          href="/"
          aria-label={`${siteConfig.name} home`}
          className="mb-6 flex flex-col items-center gap-2"
        >
          <Image
            src="/wondavu-logo-v2.png"
            alt={siteConfig.name}
            width={240}
            height={240}
            priority
            className="h-24 w-auto"
          />
          <span className="text-sm text-muted">{siteConfig.tagline}</span>
        </Link>
        <div className="wc-frame rounded-2xl p-6">
          {children}
        </div>
        <p className="mt-4 text-center text-sm text-muted">
          By continuing, you agree to our{" "}
          <Link href="/privacy" className="text-glow underline">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
