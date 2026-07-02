import { NextResponse } from "next/server";

/** JSON for endpoints where intermediaries must not cache (live feeds, etc.). */
export function jsonOkNoStore<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: {
      "cache-control": "no-store",
      "content-type": "application/json; charset=utf-8",
    },
  });
}

export function jsonError(
  message: string,
  status = 500,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json(
    { error: message, ...extra },
    {
      status,
      headers: { "cache-control": "no-store" },
    },
  );
}
