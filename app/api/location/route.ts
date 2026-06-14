export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { resolveIpLocation } from "@/lib/location/server-ip-location";
import { getClientIP } from "@/lib/utils/anonymous-session";

export async function GET(request: NextRequest) {
  const clientIp = getClientIP(request) ?? "unknown";
  const result = await resolveIpLocation(clientIp);

  if (!result) {
    return NextResponse.json({ error: "Unable to determine location from IP" }, { status: 503 });
  }

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "private, max-age=300",
    },
  });
}
