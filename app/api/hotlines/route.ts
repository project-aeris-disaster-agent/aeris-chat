export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { getHotlineDirectory } from "@/lib/emergency/hotlines";
import {
  checkRateLimit,
  clientRateKey,
  rateLimitRetryAfterSeconds,
} from "@/lib/security/rate-limit";

/**
 * Public, location-aware hotline directory for the Quick Access UI.
 * No auth: this is life-safety reference data. Coordinates are optional;
 * without them the response is the national tier only.
 */
export async function GET(request: NextRequest) {
  const limit = checkRateLimit(clientRateKey("hotlines", request), {
    windowMs: 60_000,
    max: 30,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests." },
      {
        status: 429,
        headers: { "retry-after": String(rateLimitRetryAfterSeconds(limit)) },
      },
    );
  }

  const lat = Number(request.nextUrl.searchParams.get("lat"));
  const lng = Number(request.nextUrl.searchParams.get("lng"));
  const directory = getHotlineDirectory(
    Number.isFinite(lat) ? lat : undefined,
    Number.isFinite(lng) ? lng : undefined,
  );

  return NextResponse.json(directory, {
    headers: { "cache-control": "public, max-age=3600" },
  });
}
