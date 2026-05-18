interface Wash {
  color: string;
  size: number;
  delay: string;
  opacity: number;
  top?: string;
  left?: string;
  right?: string;
  bottom?: string;
}

/**
 * Watercolor washes — soft, bubbly pigment blobs that drift behind the
 * webapp. Multiply blending lets overlaps mix like real watercolor, giving
 * the bright UI a friendly, painterly, adventurous feel.
 */
export function GlowOrbs() {
  const washes: Wash[] = [
    { color: "#ffb020", size: 460, delay: "0s", opacity: 0.5, top: "-12%", left: "-8%" },
    { color: "#0fb59f", size: 520, delay: "-4s", opacity: 0.42, top: "20%", right: "-14%" },
    { color: "#ff5a3c", size: 400, delay: "-8s", opacity: 0.4, bottom: "-10%", left: "12%" },
    { color: "#f7941d", size: 360, delay: "-6s", opacity: 0.4, top: "48%", left: "30%" },
    { color: "#6c5cff", size: 320, delay: "-11s", opacity: 0.32, bottom: "8%", right: "16%" },
  ];

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      {washes.map((w, i) => (
        <span
          key={i}
          className="watercolor-wash absolute rounded-full"
          style={{
            background: w.color,
            opacity: w.opacity,
            width: w.size,
            height: w.size,
            top: w.top,
            left: w.left,
            right: w.right,
            bottom: w.bottom,
            animation: "drift 22s ease-in-out infinite",
            animationDelay: w.delay,
          }}
        />
      ))}
    </div>
  );
}
