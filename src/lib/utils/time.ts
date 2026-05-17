/** Formats an ISO timestamp as a short local time, e.g. "14:30". */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Formats an ISO timestamp as a deterministic UTC event date, e.g.
 * "Tue 19 May · 18:30". UTC keeps server and client output identical.
 */
export function formatEventDate(iso: string): string {
  const d = new Date(iso);
  const day = DAYS[d.getUTCDay()];
  const date = d.getUTCDate();
  const month = MONTHS[d.getUTCMonth()];
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${date} ${month} · ${hh}:${mm}`;
}
