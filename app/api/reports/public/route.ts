export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import {
  listPublicReportPoints,
  sharedSupabaseReportsEnabled,
  type ReportPoint,
} from "@/lib/reports/shared-supabase";

// Short in-memory cache: report pings change slowly, so we serve a cached
// snapshot to keep this endpoint cheap under repeated opens of the map panel.
// Best-effort per instance; fine for a read-only overview.
const CACHE_TTL_MS = 60_000;
let cache: { at: number; points: ReportPoint[] } | null = null;

export async function GET() {
  try {
    if (!sharedSupabaseReportsEnabled()) {
      return NextResponse.json(
        { points: [], count: 0, available: false, generatedAt: new Date().toISOString() },
        { headers: { "cache-control": "public, max-age=60" } },
      );
    }

    const now = Date.now();
    if (!cache || now - cache.at > CACHE_TTL_MS) {
      cache = { at: now, points: await listPublicReportPoints() };
    }

    return NextResponse.json(
      {
        points: cache.points,
        count: cache.points.length,
        available: true,
        generatedAt: new Date(cache.at).toISOString(),
      },
      { headers: { "cache-control": "public, max-age=60" } },
    );
  } catch (error) {
    console.error("Public heatmap fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
