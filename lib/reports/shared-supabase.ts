import type { StoredOtp } from "@/lib/security/otp";

type SharedReport = {
  id: string;
  messageId?: string;
  category: string;
  description: string;
  position: [number, number];
  photoUrl?: string;
  createdAt: string;
  confirmations: number;
  verificationStatus?: string;
  moderationStatus?: string;
  phoneVerificationStatus?: string;
  /** True when this insert was coalesced into an existing near-duplicate. */
  deduped?: boolean;
  onchain?: {
    phoneVerificationStatus?: string;
    mint?: { status: string; network: string; chainId: number; txHash?: string };
  };
};

function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return { url: url.replace(/\/$/, ""), serviceKey };
}

export function sharedSupabaseReportsEnabled() {
  return supabaseConfig() !== null;
}

function headers(serviceKey: string) {
  return {
    apikey: serviceKey,
    authorization: `Bearer ${serviceKey}`,
    "content-type": "application/json",
  };
}

function createReportMessageId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase();
  return `AERIS-${timestamp}-${random}`;
}

async function computeDedupeHash(input: {
  category: string;
  description: string;
  position: [number, number];
}) {
  const [lng, lat] = input.position;
  const roundedLng = Math.round(lng * 1000) / 1000;
  const roundedLat = Math.round(lat * 1000) / 1000;
  const normalized = input.description
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const payload = [
    input.category.toLowerCase(),
    roundedLng.toFixed(3),
    roundedLat.toFixed(3),
    normalized.slice(0, 200),
  ].join("|");
  const data = new TextEncoder().encode(payload);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Look for a report with the same dedupe hash filed within `withinMs`. If found,
 * increment its `confirmations` and return the updated row. Returns null when no
 * recent duplicate exists (or the DB has no dedupe_hash column yet).
 */
async function confirmRecentDuplicate(
  cfg: { url: string; serviceKey: string },
  dedupeHash: string,
  withinMs: number,
): Promise<SharedReport | null> {
  const since = new Date(Date.now() - withinMs).toISOString();
  const params = new URLSearchParams({
    select: "*",
    dedupe_hash: `eq.${dedupeHash}`,
    created_at: `gte.${since}`,
    order: "created_at.desc",
    limit: "1",
  });

  let res: Response;
  try {
    res = await fetch(`${cfg.url}/rest/v1/disaster_reports?${params}`, {
      headers: headers(cfg.serviceKey),
      cache: "no-store",
    });
  } catch {
    return null;
  }
  // If dedupe_hash column is absent on older schemas, PostgREST 400s — treat as
  // "no dedup available" and let the normal insert proceed.
  if (!res.ok) return null;

  const rows = (await res.json()) as Record<string, unknown>[];
  const existing = rows[0];
  if (!existing) return null;

  const id = String(existing.id);
  const nextConfirmations = Number(existing.confirmations ?? 0) + 1;

  const patch = await fetch(
    `${cfg.url}/rest/v1/disaster_reports?id=eq.${encodeURIComponent(id)}&select=*`,
    {
      method: "PATCH",
      headers: { ...headers(cfg.serviceKey), prefer: "return=representation" },
      body: JSON.stringify({ confirmations: nextConfirmations }),
    },
  );
  if (!patch.ok) return toSharedReport(existing);
  const patched = (await patch.json()) as Record<string, unknown>[];
  return patched[0] ? toSharedReport(patched[0]) : toSharedReport(existing);
}

function toSharedReport(row: Record<string, unknown>): SharedReport {
  const metadata =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>)
      : {};
  return {
    id: String(row.id),
    messageId:
      (typeof row.report_message_id === "string" ? row.report_message_id : undefined) ??
      (typeof metadata.messageId === "string" ? metadata.messageId : undefined),
    category: String(row.category),
    description: String(row.description),
    position: [Number(row.longitude), Number(row.latitude)],
    photoUrl:
      (typeof row.photo_url === "string" && row.photo_url ? row.photo_url : undefined) ??
      (typeof metadata.photoUrl === "string" ? metadata.photoUrl : undefined),
    createdAt: String(row.created_at),
    confirmations: Number(row.confirmations ?? 0),
    verificationStatus:
      typeof row.verification_status === "string" ? row.verification_status : undefined,
    moderationStatus:
      typeof row.moderation_status === "string" ? row.moderation_status : undefined,
    phoneVerificationStatus:
      typeof row.phone_verification_status === "string"
        ? row.phone_verification_status
        : undefined,
    onchain: {
      phoneVerificationStatus:
        typeof row.phone_verification_status === "string"
          ? row.phone_verification_status
          : "unverified",
      mint: {
        status: typeof row.onchain_mint_status === "string" ? row.onchain_mint_status : "not_started",
        network: typeof row.onchain_network === "string" ? row.onchain_network : "base-mainnet",
        chainId: typeof row.onchain_chain_id === "number" ? row.onchain_chain_id : 8453,
        txHash: typeof row.onchain_tx_hash === "string" ? row.onchain_tx_hash : undefined,
      },
    },
  };
}

export async function createSharedSupabaseReport(input: {
  category: string;
  description: string;
  position: [number, number];
  anonymousId: string;
  sessionId?: string;
  locationAccuracyM?: number;
  photoUrl?: string;
  metadata?: Record<string, unknown>;
  ipHash?: string;
  /** "visible" (default) or "pending" when quality heuristics flag it. */
  moderationStatus?: string;
  /** Privy DID of the signed-in reporter; null for anonymous reports. */
  reporterUserId?: string | null;
}): Promise<SharedReport> {
  const cfg = supabaseConfig();
  if (!cfg) throw new Error("Shared Supabase is not configured.");

  const [longitude, latitude] = input.position;
  const reportMessageId = createReportMessageId();
  const dedupeHash = await computeDedupeHash({
    category: input.category,
    description: input.description,
    position: input.position,
  });

  // Anti-spam: coalesce a near-identical report filed within the dedup window
  // into the existing one (bump confirmations) instead of creating a new row.
  const duplicate = await confirmRecentDuplicate(cfg, dedupeHash, 30 * 60 * 1000);
  if (duplicate) return { ...duplicate, deduped: true };

  const insertPayload: Record<string, unknown> = {
    report_message_id: reportMessageId,
    source_app: "aeris-chat",
    source_channel: "chat_incident_modal",
    category: input.category,
    description: input.description,
    longitude,
    latitude,
    location_accuracy_m: input.locationAccuracyM ?? null,
    confidence: 0.35,
    verification_status: "unverified",
    moderation_status: input.moderationStatus ?? "visible",
    confirmations: 0,
    ip_hash: input.ipHash ?? null,
    // Privy DID of the signed-in reporter. Lets the dashboard award
    // `report_verified` XP back to this user on operator verify. TEXT column —
    // never use the legacy UUID `user_id` column for the DID.
    reporter_user_id: input.reporterUserId ?? null,
    phone_verification_status: "unverified",
    onchain_network: "base-mainnet",
    onchain_chain_id: 8453,
    onchain_mint_status: "not_started",
    ai_priority: "pending",
    dedupe_hash: dedupeHash,
    photo_url: input.photoUrl ?? null,
    metadata: {
      ...input.metadata,
      messageId: reportMessageId,
      anonymousId: input.anonymousId,
      sessionId: input.sessionId ?? null,
      photoUrl: input.photoUrl ?? null,
      onchain: {
        gasless: true,
        network: "base-mainnet",
        chainId: 8453,
        mintAfter: "phone_verification",
      },
    },
  };

  let res = await fetch(`${cfg.url}/rest/v1/disaster_reports?select=*`, {
    method: "POST",
    headers: { ...headers(cfg.serviceKey), prefer: "return=representation" },
    body: JSON.stringify(insertPayload),
  });

  if (!res.ok) {
    const errText = await res.clone().text().catch(() => "");
    if (/ai_priority|dedupe_hash|photo_url|schema cache/i.test(errText)) {
      // The photoUrl is still preserved inside metadata above, so dropping the
      // dedicated photo_url column here does not lose the evidence link.
      const { ai_priority, dedupe_hash, photo_url, ...fallbackPayload } = insertPayload;
      res = await fetch(`${cfg.url}/rest/v1/disaster_reports?select=*`, {
        method: "POST",
        headers: { ...headers(cfg.serviceKey), prefer: "return=representation" },
        body: JSON.stringify(fallbackPayload),
      });
    }
  }

  if (!res.ok) {
    throw new Error(`Shared report insert failed (${res.status})`);
  }

  const rows = (await res.json()) as Record<string, unknown>[];
  if (!rows[0]) throw new Error("Shared Supabase returned no report.");
  return toSharedReport(rows[0]);
}

export async function listSharedSupabaseReportsByAnonymousId(
  anonymousId: string,
): Promise<SharedReport[]> {
  const cfg = supabaseConfig();
  if (!cfg) return [];

  // anonymousId is interpolated into a PostgREST `cs.{...}` JSON filter; only
  // allow the UUID-ish charset our client generates so it cannot break out of
  // the JSON literal or inject additional filter clauses.
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(anonymousId)) return [];

  const params = new URLSearchParams({
    select: "*",
    metadata: `cs.{"anonymousId":"${anonymousId}"}`,
    order: "created_at.desc",
    limit: "100",
  });

  const res = await fetch(`${cfg.url}/rest/v1/disaster_reports?${params}`, {
    headers: headers(cfg.serviceKey),
    cache: "no-store",
  });

  if (!res.ok) return [];
  const rows = (await res.json()) as Record<string, unknown>[];
  return rows.map(toSharedReport);
}

async function fetchRawReportRow(
  reportId: string,
): Promise<Record<string, unknown> | null> {
  const cfg = supabaseConfig();
  if (!cfg) return null;

  const params = new URLSearchParams({
    select: "*",
    id: `eq.${reportId}`,
    limit: "1",
  });

  const res = await fetch(`${cfg.url}/rest/v1/disaster_reports?${params}`, {
    headers: headers(cfg.serviceKey),
    cache: "no-store",
  });

  if (!res.ok) return null;
  const rows = (await res.json()) as Record<string, unknown>[];
  return rows[0] ?? null;
}

function readMetadata(row: Record<string, unknown> | null): Record<string, unknown> {
  return row?.metadata && typeof row.metadata === "object"
    ? (row.metadata as Record<string, unknown>)
    : {};
}

export async function getSharedSupabaseReportById(reportId: string): Promise<SharedReport | null> {
  const row = await fetchRawReportRow(reportId);
  return row ? toSharedReport(row) : null;
}

/** Read the stored OTP challenge (if any) for a shared report. */
export async function getSharedReportOtp(reportId: string): Promise<StoredOtp | null> {
  const row = await fetchRawReportRow(reportId);
  const otp = readMetadata(row).otp;
  return otp && typeof otp === "object" ? (otp as StoredOtp) : null;
}

/**
 * Merge a partial metadata patch into a shared report without clobbering
 * existing keys (anonymousId, sessionId, messageId, ...). Pass `otp: null` in
 * the patch to clear a consumed challenge.
 */
export async function patchSharedReportMetadata(
  reportId: string,
  patch: Record<string, unknown>,
): Promise<boolean> {
  const cfg = supabaseConfig();
  if (!cfg) return false;

  const row = await fetchRawReportRow(reportId);
  if (!row) return false;

  const merged = { ...readMetadata(row), ...patch };
  if (patch.otp === null) delete merged.otp;

  const res = await fetch(
    `${cfg.url}/rest/v1/disaster_reports?id=eq.${encodeURIComponent(reportId)}`,
    {
      method: "PATCH",
      headers: headers(cfg.serviceKey),
      body: JSON.stringify({ metadata: merged }),
    },
  );
  return res.ok;
}

export async function patchSharedReportPhoneVerified(
  reportId: string,
  phoneNumber: string,
): Promise<SharedReport | null> {
  const cfg = supabaseConfig();
  if (!cfg) return null;

  const row = await fetchRawReportRow(reportId);
  if (!row) return null;

  const proxyWalletId = crypto.randomUUID();
  const proxyWalletAddress = `0x${crypto.randomUUID().replace(/-/g, "").padEnd(40, "0").slice(0, 40)}`;

  // Merge into existing metadata so anonymousId / sessionId / messageId survive,
  // and drop the now-consumed OTP challenge.
  const mergedMetadata = { ...readMetadata(row) };
  delete mergedMetadata.otp;
  mergedMetadata.verifiedPhoneNumber = phoneNumber;
  mergedMetadata.verifiedAt = new Date().toISOString();

  const res = await fetch(`${cfg.url}/rest/v1/disaster_reports?id=eq.${encodeURIComponent(reportId)}&select=*`, {
    method: "PATCH",
    headers: { ...headers(cfg.serviceKey), prefer: "return=representation" },
    body: JSON.stringify({
      phone_verification_status: "verified",
      verification_status: "verified",
      proxy_wallet_id: proxyWalletId,
      proxy_wallet_address: proxyWalletAddress,
      onchain_mint_status: "queued",
      metadata: mergedMetadata,
    }),
  });

  if (!res.ok) return null;
  const rows = (await res.json()) as Record<string, unknown>[];
  return rows[0] ? toSharedReport(rows[0]) : null;
}

export type { SharedReport };
