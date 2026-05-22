"use client";

import { usePathname } from "next/navigation";

/**
 * Page transition — each route gently fades in. Implemented with a CSS
 * keyframe (see `.page-fade` in globals.css) rather than framer-motion, so
 * list/detail routes don't pull the animation library into their bundle.
 * `key={pathname}` remounts the wrapper on navigation to replay the fade.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="page-fade flex flex-1 flex-col">
      {children}
    </div>
  );
}
