export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { AUTH_DISABLED } from "@/lib/config";

const ALLOWED_KINDS = new Set([
  "ack",
  "urgent-followup",
  "operator",
  "status-update",
]);

const ALLOWED_ROLES = new Set(["assistant", "system"]);

function isTrustedSystem(request: NextRequest): boolean {
  const secret = process.env.INTERNAL_TRIAGE_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  return header === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  let body:
    | {
        sessionId?: string;
        anonymousId?: string;
        role?: string;
        content?: string;
        metadata?: Record<string, unknown>;
      }
    | undefined;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
  const anonymousId = typeof body?.anonymousId === "string" ? body.anonymousId : "";
  const role = typeof body?.role === "string" ? body.role : "assistant";
  const content = typeof body?.content === "string" ? body.content.trim() : "";
  const incomingMetadata =
    body?.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
      ? (body.metadata as Record<string, unknown>)
      : {};

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }
  if (!content) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }
  if (content.length > 4000) {
    return NextResponse.json({ error: "content too long" }, { status: 413 });
  }
  if (!ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ error: "role must be assistant or system" }, { status: 400 });
  }

  const kind = typeof incomingMetadata.kind === "string" ? incomingMetadata.kind : "ack";
  if (!ALLOWED_KINDS.has(kind)) {
    return NextResponse.json({ error: `metadata.kind must be one of ${[...ALLOWED_KINDS].join(", ")}` }, { status: 400 });
  }

  const supabase = await createClient();
  let user = null;
  if (!AUTH_DISABLED) {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    user = authUser;
  }

  const { createClient: createServiceClient } = await import("@supabase/supabase-js");
  const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceUrl || !serviceKey) {
    return NextResponse.json({ error: "Supabase service credentials not configured" }, { status: 500 });
  }
  const serviceClient = createServiceClient(serviceUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: session, error: sessionError } = await serviceClient
    .from("chat_sessions")
    .select("user_id, anonymous_id")
    .eq("id", sessionId)
    .single();

  if (sessionError || !session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  const ownedByUser = user && session.user_id === user.id;
  const ownedByAnon = session.anonymous_id && anonymousId === session.anonymous_id;
  const trustedSystem = isTrustedSystem(request);
  if (!ownedByUser && !ownedByAnon && !trustedSystem) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const metadata = {
    ...incomingMetadata,
    kind,
    source: typeof incomingMetadata.source === "string" ? incomingMetadata.source : "aeris-agent",
  };

  const { data: inserted, error: insertError } = await serviceClient
    .from("messages")
    .insert({
      session_id: sessionId,
      role,
      content,
      metadata,
    })
    .select("id, session_id, role, content, created_at, updated_at, metadata")
    .single();

  if (insertError || !inserted) {
    return NextResponse.json(
      { error: insertError?.message ?? "Failed to insert system message" },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: inserted }, { status: 201 });
}
