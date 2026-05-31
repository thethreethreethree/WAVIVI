import { getPhotoMirrorStatus } from "@/components/admin/photo-mirror/actions";
import { PhotoMirrorClient } from "@/components/admin/photo-mirror/photo-mirror-client";

export const dynamic = "force-dynamic";

export default async function PhotoMirrorPage() {
  const initial = await getPhotoMirrorStatus();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Photo mirror</h1>
        <p className="mt-1 text-sm text-muted">
          One-shot backfill that copies every external place photo
          (Instagram, Google, Facebook CDN) into our own Supabase Storage
          bucket as a 600 px WebP, then rewrites the row&apos;s{" "}
          <code className="font-mono text-xs">photo_url</code> /{" "}
          <code className="font-mono text-xs">photo_urls</code> columns to
          point at the mirrored copies. Run this once per region you
          care about — after that, the import engines mirror new rows
          automatically as they&apos;re ingested.
        </p>
        <p className="mt-2 text-xs text-muted">
          Why: Instagram &amp; Facebook CDN URLs carry an expiry token
          (the <code className="font-mono">&amp;oe=…</code> param) and die
          within a few weeks. Mirroring locks the asset down so images
          keep working even if the source CDN rotates or the venue
          deletes its IG post.
        </p>
      </header>

      <PhotoMirrorClient initial={initial} />
    </div>
  );
}
