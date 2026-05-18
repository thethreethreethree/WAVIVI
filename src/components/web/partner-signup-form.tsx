"use client";

import { useState } from "react";

const TYPES = ["Stay", "Experience", "Event"];

const fieldClass =
  "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm " +
  "outline-none transition-colors placeholder:text-muted focus-visible:border-glow";

/** Partner listing application. Local-only until the Supabase queue is wired. */
export function PartnerSignupForm() {
  const [submitted, setSubmitted] = useState(false);

  if (submitted) {
    return (
      <div className="rounded-2xl border border-cool/40 bg-cool/10 p-6 text-center">
        <p className="text-lg font-bold text-cool">Application received 🎉</p>
        <p className="mt-1 text-sm text-muted">
          Our partnerships team will review your listing and reach out within
          2 business days.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
      }}
      className="flex flex-col gap-4 rounded-2xl bg-background p-6 ring-1 ring-border"
    >
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-muted">Business name</span>
        <input required placeholder="Sunset Hostel" className={fieldClass} />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-muted">Listing type</span>
        <select className={fieldClass} defaultValue="Stay">
          {TYPES.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted">City</span>
          <input required placeholder="Lisbon" className={fieldClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-muted">Country</span>
          <input required placeholder="Portugal" className={fieldClass} />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-muted">Contact email</span>
        <input
          required
          type="email"
          placeholder="you@business.com"
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-muted">
          Tell us about your business
        </span>
        <textarea
          rows={3}
          placeholder="What makes your place worth a traveler's time?"
          className={`${fieldClass} resize-none`}
        />
      </label>

      <button
        type="submit"
        className="mt-1 rounded-full bg-sunset py-3 text-sm font-bold text-white"
      >
        Submit application
      </button>
      <p className="text-center text-[11px] text-muted">
        By applying you agree to Travejor&apos;s partner terms.
      </p>
    </form>
  );
}
