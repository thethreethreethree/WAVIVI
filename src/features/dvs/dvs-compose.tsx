"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { createDvsShare, uploadDvsPhoto } from "@/lib/dvs/actions";

/**
 * Daily Vibe Share — 5-question composer.
 *
 * Field order matches the DVS spec:
 *   Q1  Vibe rating (1-5) + caption
 *   Q2  Where + optional photo
 *   Q3  Tip for fellow travelers (optional)
 *   Q4  Real costs (Meal / Hotel / Activity) + currency
 *   Q5  Q&A advice (optional question + answer)
 *
 * Photo uploads happen before submit so a slow upload doesn't block
 * the rest of the form. The returned public URL is stashed in
 * component state and sent along with the share payload.
 */
export function DvsCompose({
  initialRegionId,
  initialRegionLabel,
  initialCityId,
  initialCityLabel,
  initialCurrency = "USD",
}: {
  /** Region/city IDs from the user's current picker. Pre-filled so
   *  the share defaults to "where I am right now" — overridable via
   *  the location_label free-text input. */
  initialRegionId?: string | null;
  initialRegionLabel?: string | null;
  initialCityId?: string | null;
  initialCityLabel?: string | null;
  initialCurrency?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Q1
  const [vibe, setVibe] = useState<number>(0);
  const [caption, setCaption] = useState("");
  // Q2
  const [locationLabel, setLocationLabel] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  // Q3
  const [tip, setTip] = useState("");
  // Q4
  const [costMeal, setCostMeal] = useState("");
  const [costHotel, setCostHotel] = useState("");
  const [costActivity, setCostActivity] = useState("");
  const [currency, setCurrency] = useState(initialCurrency);
  // Q5
  const [qaQuestion, setQaQuestion] = useState("");
  const [qaAnswer, setQaAnswer] = useState("");

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("photo", file);
      const res = await uploadDvsPhoto(fd);
      if (res.ok) {
        setPhotoUrl(res.url);
      } else {
        setError(res.error);
      }
    } finally {
      setUploadingPhoto(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function clearPhoto() {
    setPhotoUrl(null);
  }

  function submit() {
    setError(null);
    if (vibe < 1) {
      setError("Pick a vibe rating from 1 to 5.");
      return;
    }
    if (caption.trim().length === 0) {
      setError("Add a one-line caption.");
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.append("vibe_rating", String(vibe));
      fd.append("caption", caption);
      if (initialRegionId) fd.append("region_id", initialRegionId);
      if (initialCityId) fd.append("city_id", initialCityId);
      if (locationLabel.trim()) fd.append("location_label", locationLabel);
      if (photoUrl) fd.append("photo_url", photoUrl);
      if (tip.trim()) fd.append("tip", tip);
      if (costMeal.trim()) fd.append("cost_meal", costMeal);
      if (costHotel.trim()) fd.append("cost_hotel", costHotel);
      if (costActivity.trim()) fd.append("cost_activity", costActivity);
      if (currency.trim()) fd.append("cost_currency", currency.toUpperCase());
      if (qaQuestion.trim()) fd.append("qa_question", qaQuestion);
      if (qaAnswer.trim()) fd.append("qa_answer", qaAnswer);

      const res = await createDvsShare(fd);
      if (res.ok) {
        router.push("/profile");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Q1 — Vibe + caption */}
      <FormSection title="🎈 What was the vibe today?">
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setVibe(n)}
              aria-label={`${n} out of 5`}
              className={`text-2xl transition-transform active:scale-90 ${
                n <= vibe ? "opacity-100" : "opacity-30"
              }`}
            >
              ⭐
            </button>
          ))}
          {vibe > 0 && (
            <span className="ml-2 text-xs font-bold text-glow">
              {vibe}/5
            </span>
          )}
        </div>
        <textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value.slice(0, 200))}
          placeholder="Perfect beach day, made 5 new friends"
          rows={2}
          className="w-full rounded-xl bg-surface-elevated px-3 py-2 text-sm outline-none ring-1 ring-border focus:ring-glow"
        />
        <p className="text-right text-[10px] text-muted">{caption.length}/200</p>
      </FormSection>

      {/* Q2 — Where + photo */}
      <FormSection title="📍 Where were you?">
        {initialCityLabel ? (
          <p className="text-xs text-muted">City: {initialCityLabel}</p>
        ) : initialRegionLabel ? (
          <p className="text-xs text-muted">Region: {initialRegionLabel}</p>
        ) : (
          // No region cookie set. Surface the constraint loudly so the
          // user knows submit is gated until they fix it — used to be
          // a soft hint that didn't actually block submission, so
          // un-tagged shares were leaking into the feed where no one
          // could discover them.
          <p className="rounded-lg bg-heat/10 px-3 py-2 text-xs font-bold text-heat">
            Pick a region from the globe at the top before sharing so
            your vibe shows up in the right feed.
          </p>
        )}
        <input
          type="text"
          value={locationLabel}
          onChange={(e) => setLocationLabel(e.target.value.slice(0, 120))}
          placeholder="More specific (e.g. Kayangan Lake)"
          className="w-full rounded-xl bg-surface-elevated px-3 py-2 text-sm outline-none ring-1 ring-border focus:ring-glow"
        />
        <div className="flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={onPickPhoto}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploadingPhoto || pending}
            className="rounded-full bg-glow/15 px-3 py-1.5 text-xs font-bold text-glow disabled:opacity-50"
          >
            {uploadingPhoto
              ? "Uploading…"
              : photoUrl
                ? "Replace photo"
                : "Add photo (optional)"}
          </button>
          {photoUrl && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl}
                alt=""
                className="h-12 w-12 rounded-lg object-cover ring-1 ring-border"
              />
              <button
                type="button"
                onClick={clearPhoto}
                className="text-xs text-muted underline"
              >
                Remove
              </button>
            </>
          )}
        </div>
      </FormSection>

      {/* Q3 — Tip */}
      <FormSection title="💡 Any tips for fellow travelers heading here?">
        <textarea
          value={tip}
          onChange={(e) => setTip(e.target.value.slice(0, 300))}
          placeholder="Go at sunset but arrive 2 hours early to claim the best spot."
          rows={3}
          className="w-full rounded-xl bg-surface-elevated px-3 py-2 text-sm outline-none ring-1 ring-border focus:ring-glow"
        />
        <p className="text-right text-[10px] text-muted">{tip.length}/300</p>
      </FormSection>

      {/* Q4 — Real costs */}
      <FormSection title="💰 What's the real cost here?">
        <div className="grid grid-cols-3 gap-2">
          <NumberInput value={costMeal} setValue={setCostMeal} label="Meal" />
          <NumberInput value={costHotel} setValue={setCostHotel} label="Hotel" />
          <NumberInput
            value={costActivity}
            setValue={setCostActivity}
            label="Activity"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-muted">
          Currency:
          <input
            type="text"
            value={currency}
            maxLength={3}
            onChange={(e) =>
              setCurrency(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))
            }
            placeholder="USD"
            className="w-16 rounded-lg bg-surface-elevated px-2 py-1 text-center text-xs uppercase outline-none ring-1 ring-border focus:ring-glow"
          />
        </label>
      </FormSection>

      {/* Q5 — Q&A */}
      <FormSection title="❓ One piece of advice">
        <input
          type="text"
          value={qaQuestion}
          onChange={(e) => setQaQuestion(e.target.value.slice(0, 160))}
          placeholder="Q: Is Santorini worth the hype?"
          className="w-full rounded-xl bg-surface-elevated px-3 py-2 text-sm outline-none ring-1 ring-border focus:ring-glow"
        />
        <textarea
          value={qaAnswer}
          onChange={(e) => setQaAnswer(e.target.value.slice(0, 280))}
          placeholder="A: 100%. It's touristy but magical. Go low season for better vibes."
          rows={2}
          className="w-full rounded-xl bg-surface-elevated px-3 py-2 text-sm outline-none ring-1 ring-border focus:ring-glow"
        />
      </FormSection>

      {error && (
        <p className="rounded-xl bg-heat/15 px-3 py-2 text-xs font-semibold text-heat">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        // Gate submission on having a region too — an un-tagged share
        // can't be discovered via /feed's region/city scoping, so
        // letting one through is worse UX than blocking the click.
        // The Q2 banner above tells the user why submit is greyed out.
        disabled={pending || uploadingPhoto || !initialRegionId}
        className="rounded-full bg-sunset px-5 py-3 text-sm font-bold text-white shadow-card active:scale-95 disabled:opacity-50"
      >
        {pending ? "Sharing…" : "Share today's vibe →"}
      </button>
    </div>
  );
}

function FormSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2 rounded-2xl bg-surface p-4 shadow-card ring-1 ring-border">
      <h3 className="text-sm font-bold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function NumberInput({
  value,
  setValue,
  label,
}: {
  value: string;
  setValue: (v: string) => void;
  label: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-[11px] font-bold text-muted">
      {label}
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/[^0-9]/g, ""))}
        placeholder="0"
        className="rounded-lg bg-surface-elevated px-2 py-1.5 text-sm text-foreground outline-none ring-1 ring-border focus:ring-glow"
      />
    </label>
  );
}
