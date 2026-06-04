import Link from "next/link";

/**
 * Tiny safe markdown renderer for Susen's chat bubbles.
 *
 * Handles two surface features only:
 *   - `[text](/internal-url)` → Next <Link>. Internal URLs only.
 *   - `**text**` → <strong>. Susen uses bold to call out venue names
 *     and her own questions; rendering it makes the bubble readable
 *     instead of leaking literal asterisks (visible in the screenshots
 *     before this component shipped).
 *
 * Everything else stays as plain text. We deliberately don't pull in
 * a full markdown library — Susen's persona prompt asks for "one to
 * three short sentences" so the surface area is genuinely tiny, and
 * a regex pass plus an inline parser is safer (no third-party HTML
 * sanitisation to keep in step with the model output).
 *
 * Safety:
 *   - URL must start with `/`. Anything else (http, https, javascript,
 *     data, mailto) renders as plain text.
 *   - We never use dangerouslySetInnerHTML — everything is JSX text or
 *     a <Link>/<strong>, so XSS surface is zero.
 */

type Node = string | { kind: "link"; text: string; href: string } | { kind: "bold"; text: string };

const LINK_RE = /\[([^\]]+)\]\((\/[^)\s]+)\)/g;
const BOLD_RE = /\*\*([^*]+)\*\*/g;

/** Parse the text into a flat array of plain-text / link / bold
 *  nodes. Both passes are done in a single left-to-right scan so the
 *  output is in document order. */
function parse(text: string): Node[] {
  // Pass 1: find link spans. Pass 2: split the surviving text on bold
  // markers. Doing it in two passes keeps each regex simple — we
  // never try to match a link AND bold in one pattern, which would
  // need lookarounds and balanced groups.
  const linkSpans: { start: number; end: number; text: string; href: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = LINK_RE.exec(text)) !== null) {
    linkSpans.push({
      start: m.index,
      end: m.index + m[0].length,
      text: m[1] ?? "",
      href: m[2] ?? "",
    });
  }

  const nodes: Node[] = [];
  let cursor = 0;
  const pushText = (chunk: string) => {
    if (!chunk) return;
    // Split chunk on bold markers.
    let last = 0;
    let bm: RegExpExecArray | null;
    BOLD_RE.lastIndex = 0;
    while ((bm = BOLD_RE.exec(chunk)) !== null) {
      if (bm.index > last) nodes.push(chunk.slice(last, bm.index));
      nodes.push({ kind: "bold", text: bm[1] ?? "" });
      last = bm.index + bm[0].length;
    }
    if (last < chunk.length) nodes.push(chunk.slice(last));
  };

  for (const span of linkSpans) {
    if (span.start > cursor) pushText(text.slice(cursor, span.start));
    nodes.push({ kind: "link", text: span.text, href: span.href });
    cursor = span.end;
  }
  if (cursor < text.length) pushText(text.slice(cursor));
  return nodes;
}

/** Render Susen's reply as JSX with clickable internal links + bold
 *  emphasis. */
export function SusenText({
  text,
  linkClassName,
}: {
  text: string;
  /** Optional className on rendered <Link>s — defaults to a sensible
   *  underline in the brand colour. Pass empty string to opt out. */
  linkClassName?: string;
}) {
  const nodes = parse(text);
  const linkClass =
    linkClassName ?? "font-bold text-glow underline-offset-2 hover:underline";
  return (
    <>
      {nodes.map((node, i) => {
        if (typeof node === "string") return <span key={i}>{node}</span>;
        if (node.kind === "bold") {
          return (
            <strong key={i} className="font-bold">
              {node.text}
            </strong>
          );
        }
        // Belt-and-braces: linkify.ts only emits internal `/` URLs,
        // but enforce it here too so a future code path that bypasses
        // linkifyReply can't accidentally render an external link.
        if (!node.href.startsWith("/")) {
          return <span key={i}>{node.text}</span>;
        }
        return (
          <Link key={i} href={node.href} className={linkClass}>
            {node.text}
          </Link>
        );
      })}
    </>
  );
}
