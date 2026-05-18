interface Orb {
  color: string;
  size: number;
  delay: string;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
}

/**
 * Atmospheric glow orbs — soft blurred light layers behind webapp content.
 * Pure CSS (no JS), GPU-friendly, drifts slowly for a "living" feel.
 */
export function GlowOrbs() {
  const orbs: Orb[] = [
    { color: "#ff7a18", size: 460, delay: "0s", top: "-8%", left: "-6%" },
    { color: "#a274ff", size: 520, delay: "-3s", top: "32%", right: "-12%" },
    { color: "#1fd0b0", size: 420, delay: "-6s", bottom: "-14%", left: "18%" },
  ];

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      {orbs.map((o, i) => (
        <span
          key={i}
          className="absolute rounded-full blur-[110px]"
          style={{
            background: o.color,
            opacity: 0.22,
            width: o.size,
            height: o.size,
            top: o.top,
            left: o.left,
            right: o.right,
            bottom: o.bottom,
            animation: "drift 18s ease-in-out infinite",
            animationDelay: o.delay,
          }}
        />
      ))}
    </div>
  );
}
