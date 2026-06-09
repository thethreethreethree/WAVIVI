/**
 * Renders one channel glyph (IG / WhatsApp / Email / etc.) for the
 * admin list pages. Accepts either a painted /icons/rustic/<name>.png
 * path (rendered through <img> so ThemeImgSwap can retarget it for
 * sketch / journal) or an emoji string (rendered verbatim).
 *
 * Used by 4 admin list pages — stays, restaurants, experiences,
 * utilities — which all share the same CHANNELS shape. The wrapper
 * keeps the JSX in each renderer compact instead of repeating an
 * inline ternary in every map() callback.
 */
export function ChannelIcon({
  src,
  className = "inline-block h-4 w-4 align-text-bottom object-contain",
}: {
  src: string;
  className?: string;
}) {
  // Convention: painted brand icons live under /icons/<theme>/, so
  // anything that begins with a slash is a path we want to render
  // through <img>. Anything else is an emoji — render as plain text.
  if (src.startsWith("/")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" aria-hidden className={className} />
    );
  }
  return (
    <span aria-hidden className="align-text-bottom">
      {src}
    </span>
  );
}
