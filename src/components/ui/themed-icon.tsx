"use client";

import { type ImgHTMLAttributes } from "react";

import { useThemeContext } from "@/components/ui/theme-context";
import { themedIconPath } from "@/lib/theme/cookie";

/**
 * Tiny `<img>` wrapper that resolves an `/icons/rustic/…` path against
 * the live ThemeContext.
 *
 * Use this wherever a server component needs to render a themed icon
 * BUT also wants the icon to react to client-side theme cycles. The
 * server emits the right folder for the first paint (context is
 * seeded from the cookie at SSR), and on a balloon-tap theme change
 * the context observer re-renders this img with the new folder so
 * the icon doesn't go stale.
 *
 * Always emits `data-theme-ready="1"` so the anti-flash CSS rule in
 * the root layout treats it as already resolved.
 */
export function ThemedIcon({
  src,
  ...rest
}: { src: string } & ImgHTMLAttributes<HTMLImageElement>) {
  const theme = useThemeContext();
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={themedIconPath(src, theme)} data-theme-ready="1" {...rest} />
  );
}
