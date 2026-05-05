export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createReport, deleteReport, listReports } from "@/lib/reports/store";

function isPosition(value: unknown): value is [number, number] {
  return (
    Array.isArray(value) &&
    value.length === 2 &&
    value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
  );
}

export async function GET(request: NextRequest) {
  try {
    const anonymousId = request.nextUrl.searchParams.get("anonymousId");
    if (!anonymousId) {
      return NextResponse.json({ error: "anonymousId is required" }, { status: 400 });
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
