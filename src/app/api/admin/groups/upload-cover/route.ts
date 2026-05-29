import { type NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/toolbox/admin";

const BUCKET = "chat-group-covers";
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const EXT_FOR_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * POST /api/admin/groups/upload-cover
 *
 * Accepts a multipart form-data upload with a single `file` field, writes
 * it into the `chat-group-covers` bucket via the service-role client, and
 * returns the resulting public URL. Used by the admin Group editor's
 * drop/upload control.
 *
 * The group's slug isn't known yet (upload happens BEFORE save on new
 * groups), so we name the object after the upload timestamp — that's
 * unique enough and lets us garbage-collect orphans later by age.
 */
export async function POST(req: NextRequest) {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data with a `file` field." },
      { status: 400 },
    );
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "Missing `file` field." },
      { status: 400 },
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Image is over 5 MB." },
      { status: 413 },
    );
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, or WebP allowed." },
      { status: 415 },
    );
  }

  const ext = EXT_FOR_MIME[file.type] ?? "jpg";
  // Timestamp + 8-char random suffix avoids collisions when admins upload
  // multiple covers in the same tick.
  const objectName = `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}.${ext}`;

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(BUCKET)
    .upload(objectName, file, {
      contentType: file.type,
      upsert: false,
      cacheControl: "31536000, immutable",
    });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: publicData } = admin.storage
    .from(BUCKET)
    .getPublicUrl(objectName);

  return NextResponse.json({ url: publicData.publicUrl });
}
