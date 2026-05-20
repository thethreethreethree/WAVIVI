"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { updateClaimedStay } from "@/features/partner/actions";
import type { StayRow } from "@/types/supabase";

interface Props {
  stay: StayRow;
}

/**
 * Self-management form for a stay's owner. Field allowlist mirrors the
 * server action — only the things a partner is allowed to change show
 * up. Backpack rating, region, claim status and so on stay admin-only.
 */
export function PartnerStayForm({ stay }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(stay.name);
  const [address, setAddress] = useState(stay.address ?? "");
  const [phone, setPhone] = useState(stay.phone ?? "");
  const [whatsapp, setWhatsapp] = useState(stay.whatsapp ?? "");
  const [instagram, setInstagram] = useState(stay.instagram ?? "");
  const [facebook, setFacebook] = useState(stay.facebook ?? "");
  const [email, setEmail] = useState(stay.email ?? "");
  const [website, setWebsite] = useState(stay.website ?? "");
  const [photoUrl, setPhotoUrl] = useState(stay.photo_url ?? "");
  const [description, setDescription] = useState(stay.description ?? "");
  const [pricePerNight, setPricePerNight] = useState(
    stay.price_per_night_usd != null ? String(stay.price_per_night_usd) : "",
  );
  const [checkIn, setCheckIn] = useState(stay.check_in_time ?? "");
  const [checkOut, setCheckOut] = useState(stay.check_out_time ?? "");
  const [amenities, setAmenities] = useState(stay.amenities.join(", "));

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await updateClaimedStay(stay.id, {
        name: name.trim(),
        address: address.trim() || null,
        phone: phone.trim() || null,
        whatsapp: whatsapp.trim() || null,
        instagram: instagram.trim() || null,
        facebook: facebook.trim() || null,
        email: email.trim() || null,
        website: website.trim() || null,
        photo_url: photoUrl.trim() || null,
        description: description.trim() || null,
        price_per_night_usd:
          pricePerNight.trim() === "" ? null : Number(pricePerNight),
        check_in_time: checkIn.trim() || null,
        check_out_time: checkOut.trim() || null,
        amenities: amenities
          .split(",")
          .map((a) => a.trim())
          .filter(Boolean),
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      setSavedAt(Date.now());
      router.refresh();
    });
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <Field label="Listing name">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="partner-input"
        />
      </Field>

      <Field label="Address">
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="partner-input"
        />
      </Field>

      <Field label="Description">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          placeholder="Tell travelers what makes your place special."
          className="partner-input resize-y"
        />
      </Field>

      <Field label="Cover photo URL">
        <input
          value={photoUrl}
          onChange={(e) => setPhotoUrl(e.target.value)}
          placeholder="https://…/cover.jpg"
          className="partner-input"
        />
        {photoUrl && /^https?:\/\//i.test(photoUrl) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt="Cover preview"
            className="mt-2 h-32 w-full rounded-lg border border-border object-cover"
          />
        )}
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Phone">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="partner-input"
          />
        </Field>
        <Field label="WhatsApp">
          <input
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="Number or wa.me link"
            className="partner-input"
          />
        </Field>
        <Field label="Instagram">
          <input
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="@handle or URL"
            className="partner-input"
          />
        </Field>
        <Field label="Facebook">
          <input
            value={facebook}
            onChange={(e) => setFacebook(e.target.value)}
            className="partner-input"
          />
        </Field>
        <Field label="Email">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="contact@…"
            className="partner-input"
          />
        </Field>
        <Field label="Website">
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="partner-input"
          />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Price / night (USD)">
          <input
            type="number"
            min={0}
            step={1}
            value={pricePerNight}
            onChange={(e) => setPricePerNight(e.target.value)}
            placeholder="—"
            className="partner-input"
          />
        </Field>
        <Field label="Check-in time">
          <input
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            placeholder="e.g. 14:00"
            className="partner-input"
          />
        </Field>
        <Field label="Check-out time">
          <input
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            placeholder="e.g. 11:00"
            className="partner-input"
          />
        </Field>
      </div>

      <Field label="Amenities (comma-separated)">
        <input
          value={amenities}
          onChange={(e) => setAmenities(e.target.value)}
          placeholder="Wi-Fi, A/C, Breakfast, Pool, Parking"
          className="partner-input"
        />
      </Field>

      {error && (
        <p className="rounded-lg bg-heat/15 px-3 py-2 text-xs font-semibold text-heat">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-sunset px-5 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        {savedAt && !pending && (
          <span className="text-xs font-bold text-cool">Saved ✓</span>
        )}
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-bold text-foreground">{label}</span>
      {children}
    </label>
  );
}
