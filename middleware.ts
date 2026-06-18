/**
 * Edge middleware: coarse per-IP rate limiting for LLM-touching API routes.
 *
 * This is the first line of defense against abuse / cost-based DoS. It applies
 * a broad per-IP ceiling before a request ever reaches a route handler. Each
 * route additionally enforces a tighter per-identity limit where the caller's
 * user/anonymous id is known.
 *
 * Fails open when Upstash is not configured (see lib/guardrails/rate-limit.ts).
 */

import { NextResponse, type NextRequest } from "next/server";
import { checkIpRateLimit, rateLimitHeaders } from "@/lib/guardrails/rate-limit";

export const config = {
  matcher: ["/api/chat", "/api/llm/chat", "/api/incidents/:path*"],
};

export async function middleware(request: NextRequest) {
  const result = await checkIpRateLimit(request);

  if (!result.success) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down and try again shortly." },
      { status: 429, headers: rateLimitHeaders(result) },
    );
  }

  return NextResponse.next();
}
