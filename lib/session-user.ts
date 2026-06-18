/**
 * Resolve the current session's Privy DID (user id) for gamification + profile
 * routes. Privy's web SDK stores the access token in the `privy-token` cookie;
 * we verify it server-side and return the DID ("did:privy:...").
 *
 * Returns null for anonymous visitors. AERIS CHAT is usable without login, so
 * callers must treat a null DID as "no profile / no XP" rather than an error.
 */

import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { verifyPrivyAccessToken } from "@/lib/privy-server";

function tokenFromRequest(request: NextRequest): string | null {
  return request.cookies.get("privy-token")?.value ?? null;
}

function tokenFromCookieStore(): string | null {
  try {
    return cookies().get("privy-token")?.value ?? null;
  } catch {
    return null;
  }
}

export async function resolveSessionUserId(): Promise<string | null> {
  const token = tokenFromCookieStore();
  if (!token) return null;
  const verified = await verifyPrivyAccessToken(token);
  return verified?.userId ?? null;
}

export async function resolveSessionUserIdFromRequest(
  request: NextRequest,
): Promise<string | null> {
  const token = tokenFromRequest(request);
  if (!token) return null;
  const verified = await verifyPrivyAccessToken(token);
  return verified?.userId ?? null;
}
