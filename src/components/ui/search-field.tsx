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
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        className="h-5 w-5 text-muted"
        aria-hidden
      >
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" />
      </svg>
      <input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className="w-full bg-transparent text-base outline-none placeholder:text-muted"
      />
    </div>
  );
}
