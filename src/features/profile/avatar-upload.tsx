"use client";

import { useRef, useState, useTransition } from "react";

import { uploadAvatar } from "@/features/profile/actions";

/**
 * Avatar uploader for the profile-edit screen.
 *
 *  • Click the avatar circle (or "Change photo") → opens the file picker.
 *  • On selection: shows a local object-URL preview immediately, then
 *    calls the `uploadAvatar` server action, which writes to the
 *    `avatars` bucket and updates profiles.avatar_url.
 *  • Replaces the watercolor initial fallback when no avatar exists.
 *
 * Sized to match the existing wc-frame circle (h-20 w-20) in the form.
 */
export function AvatarUpload({
  initialUrl,
  fallbackInitial,
}: {
  initialUrl: string | null;
  fallbackInitial: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initialUrl);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();

  function openPicker() {
    inputRef.current?.click();
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setSuccess(false);

    // Optimistic local preview — feels instant, swapped for the real URL
    // once the upload returns.
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);

    const fd = new FormData();
    fd.append("avatar", file);

    startTransition(async () => {
      const res = await uploadAvatar(fd);
      if (res.error) {
        setError(res.error);
        // Roll back the preview if the server rejected the upload.
        setPreviewUrl(initialUrl);
        return;
      }
      if (res.url) setPreviewUrl(res.url);
      setSuccess(true);
      // Reset the file input so picking the same file again still fires.
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={openPicker}
        disabled={pending}
        aria-label="Change profile picture"
        className="wc-frame relative block h-20 w-20 rounded-full p-1 transition-transform active:scale-95 disabled:opacity-70"
      >
        <span className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-surface-elevated text-2xl font-bold text-glow">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
          ) : (
            <span>{fallbackInitial}</span>
          )}
        </span>
        {pending && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-full bg-black/40 text-[10px] font-bold text-white">
            Uploading…
          </span>
        )}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={onPick}
        className="hidden"
      />

      <button
        type="button"
        onClick={openPicker}
        disabled={pending}
        className="mt-2 text-xs font-bold text-glow underline-offset-4 hover:underline disabled:opacity-60"
      >
        {previewUrl ? "Change photo" : "Upload a photo"}
      </button>
      <p className="mt-1 text-[10px] text-muted">PNG / JPG / WebP, up to 5 MB</p>

      {error && (
        <p className="mt-2 rounded-lg bg-heat/15 px-3 py-1.5 text-[11px] font-semibold text-heat">
          {error}
        </p>
      )}
      {success && !pending && (
        <p className="mt-2 text-[11px] font-semibold text-cool">
          Saved.
        </p>
      )}
    </div>
  );
}
