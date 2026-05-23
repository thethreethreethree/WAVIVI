/**
 * OSRM routing client — talks to the public OSRM demo instance, returning a
 * normalised `NavRoute` (distance, duration, polyline, step-by-step list).
 *
 * The public demo (router.project-osrm.org) is FREE but **explicitly not for
 * production traffic** — it's rate-limited and unmonitored. Fine for early
 * development; when usage grows, swap `OSRM_BASE` for a self-hosted OSRM
 * (~$10/mo VPS) or another routing provider (OpenRouteService, Mapbox).
 */

export type NavMode = "driving" | "walking" | "cycling";

export type NavStep = {
  /** Distance covered by this step, in metres. */
  distance: number;
  /** Step duration in seconds (at OSRM's average speed for the profile). */
  duration: number;
  /** Maneuver type: "depart" | "arrive" | "turn" | "merge" | "roundabout" | … */
  type: string;
  /** "left" | "right" | "slight left" | "sharp right" | "straight" | "uturn" | … */
  modifier?: string;
  /** Road / street name at this step (often empty for unnamed roads). */
  name: string;
  /** Manoeuvre point as [lng, lat] (OSRM order). */
  location: [number, number];
};

export type NavRoute = {
  /** Total distance, metres. */
  distance: number;
  /** Total duration, seconds. */
  duration: number;
  /** Polyline as [lng, lat] pairs (OSRM's GeoJSON order). */
  geometry: [number, number][];
  /** Flattened steps across all legs. */
  steps: NavStep[];
};

const OSRM_BASE = "https://router.project-osrm.org";

/** Fetch a route from start → end using the chosen travel profile. */
export async function fetchRoute(
  start: { lat: number; lng: number },
  end: { lat: number; lng: number },
  mode: NavMode = "driving",
  signal?: AbortSignal,
): Promise<NavRoute | null> {
  const url =
    `${OSRM_BASE}/route/v1/${mode}` +
    `/${start.lng},${start.lat};${end.lng},${end.lat}` +
    `?overview=full&geometries=geojson&steps=true`;
  const res = await fetch(url, { signal });
  if (!res.ok) return null;
  const body = (await res.json()) as OsrmResponse;
  const r = body.routes?.[0];
  if (!r) return null;

  const steps: NavStep[] = (r.legs ?? []).flatMap((leg) =>
    leg.steps.map((s) => ({
      distance: s.distance,
      duration: s.duration,
      type: s.maneuver.type,
      modifier: s.maneuver.modifier,
      name: s.name ?? "",
      location: s.maneuver.location,
    })),
  );

  return {
    distance: r.distance,
    duration: r.duration,
    geometry: r.geometry.coordinates,
    steps,
  };
}

/** Render an OSRM step into a short, human English instruction. */
export function formatStep(step: NavStep, destinationName?: string): string {
  const dir = readableDir(step.modifier);
  const onto = step.name ? ` onto ${step.name}` : "";

  switch (step.type) {
    case "depart":
      return step.name ? `Head out on ${step.name}` : "Start your route";
    case "arrive":
      return destinationName
        ? `Arrive at ${destinationName}`
        : "Arrive at your destination";
    case "turn":
      return `Turn ${dir}${onto}`;
    case "continue":
      return dir ? `Continue ${dir}${onto}` : `Continue${onto}`;
    case "merge":
      return `Merge${dir ? ` ${dir}` : ""}${onto}`;
    case "ramp":
    case "on ramp":
      return `Take the ramp${onto}`;
    case "off ramp":
      return `Take the exit${onto}`;
    case "fork":
      return `Keep ${dir}${onto}`;
    case "roundabout":
    case "rotary":
      return `Enter the roundabout${onto}`;
    case "exit roundabout":
    case "exit rotary":
      return `Exit the roundabout${onto}`;
    case "new name":
      return step.name ? `Continue on ${step.name}` : "Continue";
    default:
      return dir
        ? `Bear ${dir}${onto}`
        : step.name
          ? `Continue on ${step.name}`
          : "Continue";
  }
}

/** Pick an emoji glyph for a step — used in the step list. */
export function stepGlyph(step: NavStep): string {
  switch (step.type) {
    case "depart":
      return "🚩";
    case "arrive":
      return "🏁";
    case "roundabout":
    case "rotary":
    case "exit roundabout":
    case "exit rotary":
      return "🔄";
    case "merge":
      return "🔀";
    case "ramp":
    case "on ramp":
      return "⤴️";
    case "off ramp":
      return "⤵️";
    case "fork":
      return step.modifier === "right" ? "↗️" : "↖️";
    default:
      switch (step.modifier) {
        case "left":
          return "⬅️";
        case "right":
          return "➡️";
        case "slight left":
          return "↖️";
        case "slight right":
          return "↗️";
        case "sharp left":
          return "↩️";
        case "sharp right":
          return "↪️";
        case "straight":
          return "⬆️";
        case "uturn":
          return "🔁";
        default:
          return "•";
      }
  }
}

function readableDir(modifier?: string): string {
  switch (modifier) {
    case "left":
      return "left";
    case "right":
      return "right";
    case "slight left":
      return "slightly left";
    case "slight right":
      return "slightly right";
    case "sharp left":
      return "sharply left";
    case "sharp right":
      return "sharply right";
    case "uturn":
      return "around";
    case "straight":
      return "straight";
    default:
      return modifier ?? "";
  }
}

// ── OSRM response types (just the bits we use) ────────────────────────────
interface OsrmResponse {
  code: string;
  routes?: Array<{
    distance: number;
    duration: number;
    geometry: { coordinates: [number, number][] };
    legs?: Array<{
      steps: Array<{
        distance: number;
        duration: number;
        name?: string;
        maneuver: {
          type: string;
          modifier?: string;
          location: [number, number];
        };
      }>;
    }>;
  }>;
}
