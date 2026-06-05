export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const BUCKET = "incident-photos";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB, matches bucket file_size_limit
const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function storageConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return { url: url.replace(/\/$/, ""), serviceKey };
}

function sanitizeAnonymousId(value: string): string {
  // Keep the storage path predictable and free of traversal characters.
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "anonymous";
}

export async function POST(request: NextRequest) {
  const cfg = storageConfig();
  if (!cfg) {
    return NextResponse.json(
      { error: "Photo storage is not configured." },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 });
  }

  const file = form.get("file");
  const anonymousId = sanitizeAnonymousId(String(form.get("anonymousId") ?? ""));

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 });
  }

  const ext = ALLOWED_MIME[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "Only JPEG, PNG, WebP, or GIF images are allowed." },
      { status: 415 },
    );
  }

  if (file.size === 0) {
    return NextResponse.json({ error: "file is empty" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Image is too large. Please use an image under 5 MB." },
      { status: 413 },
    );
  }

  const supabase = createClient(cfg.url, cfg.serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const objectPath = `${anonymousId}/${crypto.randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error } = await supabase.storage.from(BUCKET).upload(objectPath, bytes, {
    contentType: file.type,
    cacheControl: "31536000",
    upsert: false,
  });

  if (error) {
    console.error("Incident photo upload failed:", error.message);
    return NextResponse.json({ error: "Failed to upload photo." }, { status: 502 });
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);

  return NextResponse.json({ photoUrl: data.publicUrl, path: objectPath }, { status: 201 });
}
