/** Star rating with an optional "traveler favourite" thumbs-up badge. */
export function Rating({
  value,
  favourite = false,
}: {
  value: number;
  favourite?: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5 text-sm">
      <span className="flex items-center gap-1 font-medium text-foreground">
        <span className="text-glow" aria-hidden>
          ★
        </span>
        {value.toFixed(1)}
      </span>
      {favourite && (
        <span
          className="flex h-5 w-5 items-center justify-center rounded-full bg-glow"
          title="Traveler favourite"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/rustic/thumbs_up_orange.png"
            alt=""
            aria-hidden
            className="h-3.5 w-3.5 object-contain"
          />
        </span>
      )}
    </span>
  );
}
