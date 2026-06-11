"use client";

import { useMemo, useState } from "react";

interface Region {
  id: string;
  displayName: string;
  country: string | null;
}
interface City {
  id: string;
  name: string;
  regionId: string;
}

const MAX_BODY = 4000;

/** In-trip feedback form. Pure client; POSTs to /api/susen/feedback
 *  which enforces auth + RLS. On success the form clears and a small
 *  thank-you panel renders so the traveller can keep submitting. */
export function SusenFeedbackForm({
  regions,
  cities,
}: {
  regions: Region[];
  cities: City[];
}) {
  const [regionId, setRegionId] = useState("");
  const [cityId, setCityId] = useState("");
  const [topic, setTopic] = useState("");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thanksId, setThanksId] = useState<string | null>(null);

  const filteredCities = useMemo(() => {
    if (!regionId) return cities;
    return cities.filter((c) => c.regionId === regionId);
  }, [regionId, cities]);

  function onRegionChange(next: string) {
    setRegionId(next);
    if (next && !cities.some((c) => c.id === cityId && c.regionId === next)) {
      setCityId("");
    }
  }
  function onCityChange(next: string) {
    setCityId(next);
    const c = cities.find((cc) => cc.id === next);
    if (c) setRegionId(c.regionId);
  }

  async function submit() {
    if (!body.trim()) return;
    const region = regions.find((r) => r.id === regionId);
    setPending(true);
    setError(null);
    setThanksId(null);
    try {
      const res = await fetch("/api/susen/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          body: body.trim(),
          country: region?.country ?? null,
          regionId: regionId || null,
          cityId: cityId || null,
          topic: topic.trim() || null,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
      };
      if (!res.ok || !json.id) {
        throw new Error(json.error ?? res.statusText);
      }
      setThanksId(json.id);
      setBody("");
      setTopic("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setPending(false);
    }
  }

  if (thanksId) {
    return (
      <div className="rounded-2xl bg-glow/10 p-5 ring-1 ring-glow/30">
        <p className="text-base font-bold">Thanks — we&apos;ve got it.</p>
        <p className="mt-1 text-sm text-muted">
          We&apos;ll review and, if it&apos;s a fit, fold it into how Susen
          answers questions about that place. Want to add more?
        </p>
        <button
          type="button"
          onClick={() => {
            setThanksId(null);
          }}
          className="mt-3 rounded-full bg-sunset px-4 py-1.5 text-xs font-bold text-white hover:bg-sunset/90"
        >
          Submit another
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-surface p-5 shadow-card ring-1 ring-border">
      {error ? (
        <p className="rounded-xl bg-heat/10 px-3 py-2 text-xs font-medium text-heat">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted">
            Region
          </label>
          <select
            value={regionId}
            onChange={(e) => onRegionChange(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sunset/40"
          >
            <option value="">Anywhere / pick a region…</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.displayName}
                {r.country ? ` — ${r.country}` : ""}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-[11px] font-bold uppercase tracking-wider text-muted">
            City (optional)
          </label>
          <select
            value={cityId}
            onChange={(e) => onCityChange(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sunset/40"
          >
            <option value="">
              {regionId ? "Pick a city…" : "Pick a region first…"}
            </option>
            {filteredCities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="text-[11px] font-bold uppercase tracking-wider text-muted">
          Topic (optional)
        </label>
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. nightlife, dive shops, late-night food"
          className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sunset/40"
        />
        <p className="mt-1 text-[11px] text-muted">
          Helps the team find related feedback when they review.
        </p>
      </div>

      <div>
        <label className="text-[11px] font-bold uppercase tracking-wider text-muted">
          What did you learn?
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          maxLength={MAX_BODY}
          placeholder="Be specific — name venues, times, and the order things happen. Example: &ldquo;Everyone starts at Frendz Hostel 8–9pm for the social hour, then Hub 9–11pm for the live DJ, then splits to Pangolin (housemusic), Rooftop (chill), or Kuridas (reggae) before ending at Amigos for late-night dancing.&rdquo;"
          className="mt-1.5 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sunset/40"
        />
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[11px] text-muted">
            {body.length}/{MAX_BODY}
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={pending || body.trim().length === 0}
            className="rounded-full bg-sunset px-5 py-1.5 text-xs font-bold text-white hover:bg-sunset/90 disabled:opacity-50"
          >
            {pending ? "Sending…" : "Send feedback"}
          </button>
        </div>
      </div>
    </div>
  );
}
