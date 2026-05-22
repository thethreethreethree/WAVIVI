"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { RestaurantRow } from "@/types/supabase";

interface Props {
  restaurant: RestaurantRow;
  onClose: () => void;
}

/** Modal editor for a single restaurant row. Saves via PATCH. */
export function RestaurantEditor({ restaurant, onClose }: Props) {
  const router = useRouter();
  const [name, setName] = useState(restaurant.name);
  const [cuisine, setCuisine] = useState(restaurant.cuisine ?? "");
  const [priceRange, setPriceRange] = useState(restaurant.price_range ?? "");
  const [address, setAddress] = useState(restaurant.address ?? "");
  const [phone, setPhone] = useState(restaurant.phone ?? "");
  const [whatsapp, setWhatsapp] = useState(restaurant.whatsapp ?? "");
  const [instagram, setInstagram] = useState(restaurant.instagram ?? "");
  const [facebook, setFacebook] = useState(restaurant.facebook ?? "");
  const [email, setEmail] = useState(restaurant.email ?? "");
  const [website, setWebsite] = useState(restaurant.website ?? "");
  const [photoUrl, setPhotoUrl] = useState(restaurant.photo_url ?? "");
  const [description, setDescription] = useState(restaurant.description ?? "");
  const [rating, setRating] = useState(restaurant.backpack_rating);
  const [googleRating, setGoogleRating] = useState(
    restaurant.rating != null ? String(restaurant.rating) : "",
  );
  const [reviewCount, setReviewCount] = useState(
    String(restaurant.review_count),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/restaurants/${restaurant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          cuisine: cuisine.trim() || "other",
          price_range: priceRange.trim() || null,
          address: address.trim() || null,
          phone: phone.trim() || null,
          whatsapp: whatsapp.trim() || null,
          instagram: instagram.trim() || null,
          facebook: facebook.trim() || null,
          email: email.trim() || null,
          website: website.trim() || null,
          photo_url: photoUrl.trim() || null,
          description: description.trim() || null,
          backpack_rating: rating,
          rating: googleRating.trim() === "" ? null : Number(googleRating),
          review_count: Number(reviewCount) || 0,
        }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(b?.error ?? `Save failed (${res.status})`);
      }
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface shadow-card ring-1 ring-border sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-surface px-4 py-3">
          <h3 className="text-sm font-bold">Edit restaurant</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-border"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="admin-input"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Cuisine">
              <input
                value={cuisine}
                onChange={(e) => setCuisine(e.target.value)}
                placeholder="e.g. Seafood"
                className="admin-input"
              />
            </Field>
            <Field label="Price range">
              <input
                value={priceRange}
                onChange={(e) => setPriceRange(e.target.value)}
                placeholder="e.g. $$"
                className="admin-input"
              />
            </Field>
          </div>

          <Field label="Address">
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="admin-input"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="admin-input"
              />
            </Field>
            <Field label="WhatsApp">
              <input
                value={whatsapp}
                onChange={(e) => setWhatsapp(e.target.value)}
                placeholder="Number or link"
                className="admin-input"
              />
            </Field>
            <Field label="Instagram">
              <input
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="@handle or URL"
                className="admin-input"
              />
            </Field>
            <Field label="Facebook">
              <input
                value={facebook}
                onChange={(e) => setFacebook(e.target.value)}
                className="admin-input"
              />
            </Field>
            <Field label="Email">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@…"
                className="admin-input"
              />
            </Field>
            <Field label="Website">
              <input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="admin-input"
              />
            </Field>
          </div>

          <Field label="Photo URL">
            <input
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://…/cover.jpg"
              className="admin-input"
            />
            {photoUrl && /^https?:\/\//i.test(photoUrl) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt="Cover preview"
                className="mt-2 h-28 w-full rounded-lg border border-border object-cover"
              />
            )}
          </Field>

          <Field label={`Backpack rating — ${rating.toFixed(1)} / 5`}>
            <input
              type="range"
              min={0}
              max={5}
              step={0.5}
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              className="w-full accent-glow"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Google rating">
              <input
                type="number"
                min={0}
                max={5}
                step={0.1}
                value={googleRating}
                onChange={(e) => setGoogleRating(e.target.value)}
                placeholder="—"
                className="admin-input"
              />
            </Field>
            <Field label="Review count">
              <input
                type="number"
                min={0}
                step={1}
                value={reviewCount}
                onChange={(e) => setReviewCount(e.target.value)}
                className="admin-input"
              />
            </Field>
          </div>

          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="admin-input resize-y"
            />
          </Field>

          {error && (
            <p className="rounded-lg bg-heat/15 px-3 py-2 text-xs font-semibold text-heat">
              {error}
            </p>
          )}
        </div>

        <div className="sticky bottom-0 flex gap-2 border-t border-border bg-surface px-4 py-3">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded-full bg-sunset px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-bold text-muted hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
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
    <label className="flex flex-col gap-1">
      <span className="text-xs font-bold text-muted">{label}</span>
      {children}
    </label>
  );
}
