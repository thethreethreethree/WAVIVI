/** Susen's visual mark — a watercolor sunset orb with a crisp orbit glyph. */
export function SusenAvatar({
  className = "h-9 w-9",
}: {
  className?: string;
}) {
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center rounded-full ${className}`}
    >
      {/* Painted orange orb with an organic edge */}
      <span
        className="wc-edge absolute inset-0 rounded-full bg-sunset"
        aria-hidden
      />
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinecap="round"
        className="relative h-[58%] w-[58%]"
        aria-hidden
      >
        <circle cx="12" cy="12" r="2.4" fill="#fff" stroke="none" />
        <path d="M12 3.3a8.7 8.7 0 0 1 0 17.4" opacity="0.95" />
        <path d="M12 20.7A8.7 8.7 0 0 1 12 3.3" opacity="0.5" />
        <circle cx="12" cy="3.3" r="1.2" fill="#fff" stroke="none" />
      </svg>
    </span>
  );
}
