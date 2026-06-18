export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createReport, deleteReport, listReports } from "@/lib/reports/store";
import {
  createSharedSupabaseReport,
  listSharedSupabaseReportsByAnonymousId,
  sharedSupabaseReportsEnabled,
} from "@/lib/reports/shared-supabase";
import { notifyTriageForReport, triageNotifyEnabled } from "@/lib/reports/triage-notify";
import { resolveSessionUserIdFromRequest } from "@/lib/session-user";
import { ensureUserProfile, userProfilesEnabled } from "@/lib/user-profiles";
import { awardXp } from "@/lib/gamification";

function isPosition(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
  );
}

function sanitizePhotoUrl(value: unknown): string | undefined {
  // Per the Dashboard intake contract, photoUrl must be an http(s) URL only.
  if (typeof value !== "string" || value.trim() === "") return undefined;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
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
    const photoUrl = sanitizePhotoUrl(body.photoUrl);

    // Resolve the signed-in reporter's Privy DID (null for anonymous users).
    // Tagging the report with it lets the dashboard award `report_verified` XP
    // back to this user on operator verify.
    const reporterUserId = await resolveSessionUserIdFromRequest(request);

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
          photoUrl,
          metadata: body.metadata && typeof body.metadata === "object" ? body.metadata : {},
          ipHash,
          reporterUserId,
        });

        if (triageNotifyEnabled() && report?.id) {
          void notifyTriageForReport(report.id);
        }

        // Award submit_report XP to signed-in reporters. Sync the profile first
        // because award_xp no-ops when the profile row is missing. Idempotent
        // via the stable dedupe key, so this never double-rewards.
        if (reporterUserId && userProfilesEnabled() && report?.id) {
          try {
            await ensureUserProfile({ userId: reporterUserId });
            await awardXp(reporterUserId, "submit_report", {
              refId: report.id,
              dedupeKey: `submit_report:${report.id}`,
            });
          } catch (xpError) {
            console.error("submit_report XP award failed:", xpError);
          }
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
      photoUrl,
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
