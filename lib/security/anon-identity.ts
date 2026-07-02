/**
 * Server-authoritative anonymous identity.
 *
 * Previously routes trusted a client-supplied `anonymousId` (a localStorage
 * UUID) as identity, which is forgeable: a client can claim any id to write /
 * read data attributed to it. This module binds the identity to a signed,
 * HttpOnly cookie so the server no longer trusts the request body.
 *
 * Migration strategy — "adopt on first use": the first time we see a caller
 * without a valid cookie, we adopt their existing localStorage id (validated)
 * and mint a signed cookie for it. This preserves ownership of sessions/reports
 * already created under that id. On every subsequent request the cookie is the
 * source of truth and any differing body/query `anonymousId` is ignored, so
 * cross-request forgery is eliminated.
 */

import { cookies } from "next/headers";

const COOKIE_NAME = "aeris_anon";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 year
const ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

function isValidId(value: unknown): value is string {
  return typeof value === "string" && ID_PATTERN.test(value);
}

function signingSecret(): string {
  return (
    process.env.ANON_ID_SECRET?.trim() ||
    // Fall back to another server-only secret so signatures are non-trivial even
    // if ANON_ID_SECRET is unset. Set ANON_ID_SECRET explicitly in production.
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "aeris-anon-dev-secret"
  );
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(id: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(id));
  return toBase64Url(new Uint8Array(sig));
}

/** Timing-safe-ish comparison of equal-length signature strings. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signAnonId(id: string): Promise<string> {
  return `${id}.${await hmac(id)}`;
}

export async function verifySignedAnonId(value: string | undefined): Promise<string | null> {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const id = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  if (!isValidId(id)) return null;
  const expected = await hmac(id);
  return safeEqual(sig, expected) ? id : null;
}

/**
 * Resolve the authoritative anonymous id for this request. If a valid signed
 * cookie is present its id is returned and any `fallbackId` is ignored. If not,
 * the (validated) `fallbackId` is adopted — or a fresh UUID minted — and a
 * signed cookie is set on the response.
 *
 * Safe to call from any App Router Route Handler (GET/POST/...).
 */
export async function resolveAnonId(fallbackId?: string | null): Promise<string> {
  const store = cookies();
  const existing = await verifySignedAnonId(store.get(COOKIE_NAME)?.value);
  if (existing) return existing;

  const id = isValidId(fallbackId) ? fallbackId : crypto.randomUUID();
  store.set(COOKIE_NAME, await signAnonId(id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return id;
}

/** Read the authoritative id without minting/adopting. Null if no valid cookie. */
export async function peekAnonId(): Promise<string | null> {
  return verifySignedAnonId(cookies().get(COOKIE_NAME)?.value);
}
