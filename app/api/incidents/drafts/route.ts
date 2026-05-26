export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import {
  incidentDraftsEnabled,
  listOpenDraftsForSession,
  patchDraft,
} from "@/lib/incidents/draft-store";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
  }
  if (!incidentDraftsEnabled()) {
    return NextResponse.json({ drafts: [], configured: false });
  }
  const rows = await listOpenDraftsForSession(sessionId);
  return NextResponse.json({ drafts: rows, configured: true });
}

/**
 * PATCH /api/incidents/drafts?id=<draftId>
 *
 * Used by the chat client to record status transitions (e.g. mark cancelled)
 * and to wire the confirmed report id once the user submits via /api/reports.
 */
export async function PATCH(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }
  let body: {
    status?: "open" | "confirmed" | "cancelled" | "expired";
    confirmedReportId?: string | null;
  } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const status = body.status;
  if (status && !["open", "confirmed", "cancelled", "expired"].includes(status)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }

  const row = await patchDraft(id, {
    status,
    confirmedReportId: body.confirmedReportId,
  });
  if (!row) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }
  return NextResponse.json({ draft: row });
}
