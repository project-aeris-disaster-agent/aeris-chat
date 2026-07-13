export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import {
  checkRateLimit,
  clientRateKey,
  rateLimitRetryAfterSeconds,
} from "@/lib/security/rate-limit";
import { resolveAnonId } from "@/lib/security/anon-identity";

const BUCKET = "incident-photos";
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB, matches bucket file_size_limit
const ALLOWED_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function storageConfig() {
  try {
    return createServiceClient();
  } catch {
    return null;
  }
}

function sanitizeAnonymousId(value: string): string {
  // Keep the storage path predictable and free of traversal characters.
  return value.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64) || "anonymous";
}

export async function POST(request: NextRequest) {
  const supabase = storageConfig();
  if (!supabase) {
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
  // Storage path is scoped to the server-authoritative id, not the form value.
  const anonymousId = sanitizeAnonymousId(
    await resolveAnonId(String(form.get("anonymousId") ?? "")),
  );

  const uploadLimit = checkRateLimit(clientRateKey("report-photo", request, anonymousId), {
    windowMs: 60 * 60 * 1000,
    max: 20,
  });
  if (!uploadLimit.allowed) {
    return NextResponse.json(
      { error: "Too many photo uploads. Please try again later." },
      {
        status: 429,
        headers: { "retry-after": String(rateLimitRetryAfterSeconds(uploadLimit)) },
      },
    );
  }

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
