/**
 * One-time-password helpers for phone verification.
 *
 * Codes are generated with a CSPRNG and never stored or transmitted in the
 * clear. Only a salted SHA-256 hash is persisted (in the report metadata), and
 * verification compares hashes. Codes expire and lock out after too many
 * attempts.
 */

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const OTP_MAX_ATTEMPTS = 5;

export type StoredOtp = {
  hash: string;
  phoneNumber: string;
  expiresAt: number; // epoch ms
  attempts: number;
};

/** Cryptographically strong 6-digit code as a string (zero-padded). */
export function generateOtpCode(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] % 1_000_000).toString().padStart(6, "0");
}

function otpSalt(): string {
  return process.env.OTP_HASH_SALT?.trim() || "aeris-otp-salt";
}

export async function hashOtpCode(code: string, phoneNumber: string): Promise<string> {
  const data = new TextEncoder().encode(`${code}|${phoneNumber}|${otpSalt()}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function buildStoredOtp(
  code: string,
  phoneNumber: string,
): Promise<StoredOtp> {
  return {
    hash: await hashOtpCode(code, phoneNumber),
    phoneNumber,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  };
}

export type OtpCheckResult =
  | { ok: true }
  | { ok: false; reason: "missing" | "expired" | "locked" | "mismatch" };

export async function verifyStoredOtp(
  stored: StoredOtp | null | undefined,
  code: string,
  phoneNumber: string,
): Promise<OtpCheckResult> {
  if (!stored || !stored.hash) return { ok: false, reason: "missing" };
  if (Date.now() > stored.expiresAt) return { ok: false, reason: "expired" };
  if ((stored.attempts ?? 0) >= OTP_MAX_ATTEMPTS) return { ok: false, reason: "locked" };
  const candidate = await hashOtpCode(code, phoneNumber);
  if (candidate !== stored.hash) return { ok: false, reason: "mismatch" };
  return { ok: true };
}

/** Only expose the raw code back to the client in explicit dev/test mode. */
export function shouldExposeDevOtp(): boolean {
  return process.env.EXPOSE_DEV_OTP === "true";
}

export { OTP_MAX_ATTEMPTS };
