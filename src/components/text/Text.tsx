/**
 * WONDAVU TEXT COMPONENTS
 * ───────────────────────
 * The canonical way to render text. Never write inline `style={{ fontSize }}`
 * or `className="text-3xl font-bold"` for ad-hoc styling — pick one of the
 * named components below (or the `<Text variant="...">` escape hatch).
 *
 * Usage:
 *   <DisplayText>Wondavu</DisplayText>
 *   <JournalText>Day three. The water is so clear it doesn't look real.</JournalText>
 *   <QuoteText>&quot;MEET. VIBE. MOVE.&quot;</QuoteText>
 *   <Heading level={1}>Page Title</Heading>
 *   <BodyText>Standard paragraph text.</BodyText>
 *   <Caption>Posted 2h ago</Caption>
 */
import { createElement } from "react";

import { textStyles, type TextStyleName } from "@/design/typography";

type AsTag = "h1" | "h2" | "h3" | "p" | "span" | "div" | "label" | "small";

interface TextProps extends React.HTMLAttributes<HTMLElement> {
  variant: TextStyleName;
  as?: AsTag;
  className?: string;
  children: React.ReactNode;
}

function defaultTagFor(variant: TextStyleName): AsTag {
  switch (variant) {
    case "h1":
    case "display":
      return "h1";
    case "h2":
      return "h2";
    case "h3":
      return "h3";
    case "caption":
    case "label":
    case "button":
      return "span";
    default:
      return "p";
  }
}

export function Text({
  variant,
  as,
  className = "",
  style,
  children,
  ...rest
}: TextProps) {
  const tag = as ?? defaultTagFor(variant);
  const variantStyle = textStyles[variant] as React.CSSProperties;
  return createElement(
    tag,
    {
      className: `wv-text wv-text--${variant} ${className}`.trim(),
      style: { ...variantStyle, ...style },
      ...rest,
    },
    children,
  );
}

// Named convenience components — preferred usage.
type Variant<T extends TextStyleName> = Omit<TextProps, "variant"> & {
  variant?: T;
};

export const DisplayText = (p: Variant<"display">) => (
  <Text variant="display" {...p} />
);
export const JournalText = (p: Variant<"journal">) => (
  <Text variant="journal" {...p} />
);
export const QuoteText = (p: Variant<"quote">) => (
  <Text variant="quote" {...p} />
);
export const BodyText = (p: Variant<"body">) => <Text variant="body" {...p} />;
export const BodyTextLg = (p: Variant<"bodyLarge">) => (
  <Text variant="bodyLarge" {...p} />
);
export const BodyTextSm = (p: Variant<"bodySmall">) => (
  <Text variant="bodySmall" {...p} />
);
export const Caption = (p: Variant<"caption">) => (
  <Text variant="caption" {...p} />
);
export const Label = (p: Variant<"label">) => <Text variant="label" {...p} />;
export const ButtonText = (p: Variant<"button">) => (
  <Text variant="button" {...p} />
);

interface HeadingProps extends Omit<TextProps, "variant"> {
  level?: 1 | 2 | 3;
}
export const Heading = ({ level = 1, ...p }: HeadingProps) => (
  <Text variant={`h${level}` as TextStyleName} {...p} />
);
