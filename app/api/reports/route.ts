export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createReport, deleteReport, listReports } from "@/lib/reports/store";
import {
  createSharedSupabaseReport,
  listSharedSupabaseReportsByAnonymousId,
  sharedSupabaseReportsEnabled,
} from "@/lib/reports/shared-supabase";
import { notifyTriageForReport, triageNotifyEnabled } from "@/lib/reports/triage-notify";
import { assessReportQuality, isUrgentReport } from "@/lib/reports/spam-heuristics";
import {
  checkRateLimit,
  clientRateKey,
  rateLimitRetryAfterSeconds,
} from "@/lib/security/rate-limit";
import { resolveAnonId } from "@/lib/security/anon-identity";
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
  // photoUrl must point at our own incident-photos storage bucket. This blocks
  // arbitrary-URL injection (SSRF / off-platform image hotlinking / tracking).
  if (typeof value !== "string" || value.trim() === "") return undefined;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:") return undefined;
  if (!url.pathname.includes("/storage/v1/object/public/incident-photos/")) {
    return undefined;
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (supabaseUrl) {
    try {
      if (url.origin !== new URL(supabaseUrl).origin) return undefined;
    } catch {
      return undefined;
    }
  }
  return url.toString();
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
    // Authoritative identity from the signed cookie; the query value is ignored
    // for ownership so callers cannot list another id's reports.
    const anonymousId = await resolveAnonId(request.nextUrl.searchParams.get("anonymousId"));

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
    const anonymousId = await resolveAnonId(
      typeof body.anonymousId === "string" ? body.anonymousId : undefined,
    );

    if (!category) {
      return NextResponse.json({ error: "category is required" }, { status: 400 });
    }
    if (!description) {
      return NextResponse.json({ error: "description is required" }, { status: 400 });
    }
    if (!isPosition(body.position)) {
      return NextResponse.json({ error: "position must be [longitude, latitude]" }, { status: 400 });
    }

    // --- Invisible + tiered anti-spam --------------------------------------
    // Urgent / SOS reports are ALWAYS accepted, one tap, no challenge. Only
    // non-urgent reports are soft-throttled; over-limit urgent reports are still
    // written but flagged for operator attention rather than rejected.
    const urgent = isUrgentReport(category, description);
    const rateResult = checkRateLimit(clientRateKey("report-create", request, anonymousId), {
      windowMs: 60_000,
      max: 5,
    });
    if (!urgent && !rateResult.allowed) {
      return NextResponse.json(
        { error: "You're filing reports too quickly. Please wait a moment." },
        {
          status: 429,
          headers: { "retry-after": String(rateLimitRetryAfterSeconds(rateResult)) },
        },
      );
    }
    const rateFlagged = urgent && !rateResult.allowed;

    // Quality gate for NON-urgent reports only: low-quality ones publish as
    // "pending" (moderation queue) instead of "visible". Urgent stays visible.
    const quality = urgent
      ? { lowQuality: false, reasons: [] as string[] }
      : assessReportQuality({ description, position: body.position });
    const moderationStatus = quality.lowQuality ? "pending" : "visible";

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
          metadata: {
            ...(body.metadata && typeof body.metadata === "object" ? body.metadata : {}),
            urgent,
            ...(rateFlagged ? { rate_flagged: true } : {}),
            ...(quality.reasons.length ? { quality_flags: quality.reasons } : {}),
          },
          ipHash,
          moderationStatus,
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
      metadata: {
        ...(body.metadata && typeof body.metadata === "object" ? body.metadata : {}),
        urgent,
        ...(rateFlagged ? { rate_flagged: true } : {}),
        ...(quality.reasons.length ? { quality_flags: quality.reasons } : {}),
      },
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
    const anonymousId = await resolveAnonId(
      typeof body.anonymousId === "string" ? body.anonymousId : undefined,
    );

    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
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
