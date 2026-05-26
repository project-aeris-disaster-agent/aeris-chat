type SharedReport = {
  id: string;
  messageId?: string;
  category: string;
  description: string;
  position: [number, number];
  createdAt: string;
  confirmations: number;
  verificationStatus?: string;
  moderationStatus?: string;
  phoneVerificationStatus?: string;
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
  metadata?: Record<string, unknown>;
  ipHash?: string;
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
    moderation_status: "visible",
    confirmations: 0,
    ip_hash: input.ipHash ?? null,
    phone_verification_status: "unverified",
    onchain_network: "base-mainnet",
    onchain_chain_id: 8453,
    onchain_mint_status: "not_started",
    ai_priority: "pending",
    dedupe_hash: dedupeHash,
    metadata: {
      ...input.metadata,
      messageId: reportMessageId,
      anonymousId: input.anonymousId,
      sessionId: input.sessionId ?? null,
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
    if (/ai_priority|dedupe_hash|schema cache/i.test(errText)) {
      const { ai_priority, dedupe_hash, ...fallbackPayload } = insertPayload;
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

export async function getSharedSupabaseReportById(reportId: string): Promise<SharedReport | null> {
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
  return rows[0] ? toSharedReport(rows[0]) : null;
}

export async function patchSharedReportPhoneVerified(
  reportId: string,
  phoneNumber: string,
): Promise<SharedReport | null> {
  const cfg = supabaseConfig();
  if (!cfg) return null;

  const current = await getSharedSupabaseReportById(reportId);
  if (!current) return null;

  const proxyWalletId = crypto.randomUUID();
  const proxyWalletAddress = `0x${crypto.randomUUID().replace(/-/g, "").padEnd(40, "0").slice(0, 40)}`;

  const res = await fetch(`${cfg.url}/rest/v1/disaster_reports?id=eq.${encodeURIComponent(reportId)}&select=*`, {
    method: "PATCH",
    headers: { ...headers(cfg.serviceKey), prefer: "return=representation" },
    body: JSON.stringify({
      phone_verification_status: "verified",
      verification_status: "verified",
      proxy_wallet_id: proxyWalletId,
      proxy_wallet_address: proxyWalletAddress,
      onchain_mint_status: "queued",
      metadata: {
        verifiedPhoneNumber: phoneNumber,
        verifiedAt: new Date().toISOString(),
      },
    }),
  });

  if (!res.ok) return null;
  const rows = (await res.json()) as Record<string, unknown>[];
  return rows[0] ? toSharedReport(rows[0]) : null;
}

export type { SharedReport };
