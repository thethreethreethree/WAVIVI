/** Rounded search input used across discovery screens. */
export function SearchField({
  placeholder,
  value,
  onChange,
  filled = false,
}: {
  placeholder: string;
  value?: string;
  onChange?: (value: string) => void;
  /** Light grey fill (list screens) vs. white with border. */
  filled?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-full px-4 py-3 ${
        filled
          ? "bg-surface-elevated"
          : "wc-frame bg-transparent"
      }`}
    >
      {/* Painted search glyph — ThemeImgSwap retargets to sketch /
          journal automatically. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/icons/rustic/search.png"
        alt=""
        aria-hidden
        className="h-5 w-5 shrink-0 object-contain"
      />
      <input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="w-full bg-transparent text-xl outline-none placeholder:text-muted"
      />
    </div>
  );
}
