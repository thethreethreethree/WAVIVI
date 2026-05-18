"use client";

import { usePathname } from "next/navigation";
import { motion } from "motion/react";

/**
 * Page transition — each route swings in like a turning journal page,
 * hinged on the left "spine" with a soft 3D rotation.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <motion.div
      key={pathname}
      initial={{ rotateY: -32, opacity: 0, x: 16 }}
      animate={{ rotateY: 0, opacity: 1, x: 0 }}
      transition={{ duration: 0.5, ease: [0.33, 1, 0.68, 1] }}
      style={{
        transformPerspective: 1400,
        transformOrigin: "left center",
      }}
      className="flex flex-1 flex-col"
    >
      {children}
    </motion.div>
  );
}
