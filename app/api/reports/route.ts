export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createReport, deleteReport, listReports } from "@/lib/reports/store";
import {
  createSharedSupabaseReport,
  listSharedSupabaseReportsByAnonymousId,
  sharedSupabaseReportsEnabled,
} from "@/lib/reports/shared-supabase";
import { notifyTriageForReport, triageNotifyEnabled } from "@/lib/reports/triage-notify";

function isPosition(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
  );
}

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip + "|aeris-salt");
  const buf = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(buf);
  return Array.from(bytes.slice(0, 8))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function getClientIp(request: NextRequest) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function GET(request: NextRequest) {
  try {
    const anonymousId = request.nextUrl.searchParams.get("anonymousId");
    if (!anonymousId) {
      return NextResponse.json({ error: "anonymousId is required" }, { status: 400 });
    }

    if (sharedSupabaseReportsEnabled()) {
      const shared = await listSharedSupabaseReportsByAnonymousId(anonymousId);
      if (shared.length > 0) {
        return NextResponse.json({ reports: shared });
      }
    }

    const reports = await listReports(anonymousId);
    return NextResponse.json({ reports });
  } catch (error) {
    console.error("Reports fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const category = typeof body.category === "string" ? body.category : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const anonymousId = typeof body.anonymousId === "string" ? body.anonymousId : "";

    if (!category) {
      return NextResponse.json({ error: "category is required" }, { status: 400 });
    }
    if (!description) {
      return NextResponse.json({ error: "description is required" }, { status: 400 });
    }
    if (!isPosition(body.position)) {
      return NextResponse.json({ error: "position must be [longitude, latitude]" }, { status: 400 });
    }
    if (!anonymousId) {
      return NextResponse.json({ error: "anonymousId is required" }, { status: 400 });
    }

    const ipHash = await hashIp(getClientIp(request));

    if (sharedSupabaseReportsEnabled()) {
      try {
        const report = await createSharedSupabaseReport({
          category,
          description,
          position: body.position,
          anonymousId,
          sessionId: typeof body.sessionId === "string" ? body.sessionId : undefined,
          locationAccuracyM:
            typeof body.locationAccuracyM === "number" && Number.isFinite(body.locationAccuracyM)
              ? body.locationAccuracyM
              : undefined,
          metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
          ipHash,
        });

        if (triageNotifyEnabled() && report?.id) {
          void notifyTriageForReport(report.id);
        }

        return NextResponse.json({ report }, { status: 201 });
      } catch (error) {
        console.error("Shared Supabase report insert failed, falling back to local store:", error);
      }
    }

    const report = await createReport({
      category,
      description,
      position: body.position,
      anonymousId,
      sessionId: typeof body.sessionId === "string" ? body.sessionId : undefined,
      locationAccuracyM:
        typeof body.locationAccuracyM === "number" && Number.isFinite(body.locationAccuracyM)
          ? body.locationAccuracyM
          : undefined,
      metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
    });

    return NextResponse.json({ report });
  } catch (error) {
    console.error("Report creation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const id = typeof body.id === "string" ? body.id : "";
    const anonymousId = typeof body.anonymousId === "string" ? body.anonymousId : "";

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    if (!anonymousId) {
      return NextResponse.json({ error: "anonymousId is required" }, { status: 400 });
    }

    const deleted = await deleteReport(id, anonymousId);
    if (!deleted) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Report deletion error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
