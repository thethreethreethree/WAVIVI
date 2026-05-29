"use client";

import { useState } from "react";

const CATEGORIES = [
  { id: "bug", label: "App bug" },
  { id: "scam", label: "Scam or fraud" },
  { id: "harassment", label: "Harassment" },
  { id: "fake_profile", label: "Fake profile" },
  { id: "missing_place", label: "Missing place" },
  { id: "wrong_info", label: "Wrong info on a place" },
  { id: "other", label: "Something else" },
] as const;

type Category = (typeof CATEGORIES)[number]["id"];

export function ReportForm() {
  const [category, setCategory] = useState<Category>("bug");
  const [details, setDetails] = useState("");
  const [sent, setSent] = useState(false);

  function submit() {
    const subject = `[${category}] Wondavu report`;
    const body =
      `Category: ${category}\n\n` +
      `Details:\n${details}\n\n` +
      `(Sent from the in-app report form.)`;
    window.location.href = `mailto:support@wondavu.com?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
    setSent(true);
  }

  return (
    <div className="wc-frame flex flex-col gap-3 rounded-2xl p-4">
      <label className="flex flex-col gap-1.5">
        <span className="text-base font-semibold text-muted">Category</span>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          className="rounded-xl bg-surface-elevated px-3 py-2.5 text-base outline-none ring-1 ring-border focus-visible:ring-glow"
        >
          {CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-base font-semibold text-muted">
          What happened?
        </span>
        <textarea
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          rows={6}
          placeholder="Be as specific as you can — what you did, what went wrong, the place / traveler involved if any."
          className="rounded-xl bg-surface-elevated px-3 py-2.5 text-base outline-none ring-1 ring-border focus-visible:ring-glow"
        />
      </label>

      <button
        type="button"
        onClick={submit}
        disabled={details.trim().length < 8}
        className="mt-1 rounded-xl bg-glow px-4 py-3 text-base font-semibold text-white transition-opacity active:opacity-80 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {sent ? "Opened your mail app ✓" : "Send to Wondavu"}
      </button>
      <p className="text-xs text-muted">
        Opens your mail app pre-filled. We log every reply at our support
        inbox and respond within 48 hours.
      </p>
    </div>
  );
}
