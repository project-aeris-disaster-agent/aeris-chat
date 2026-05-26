export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

type ReportRow = {
  id: string;
  report_message_id: string | null;
  verification_status: string | null;
  moderation_status: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  ai_priority: string | null;
  ai_triage_at: string | null;
  ai_triage_confidence: number | null;
  phone_verification_status: string | null;
  onchain_network: string | null;
  onchain_chain_id: number | null;
  onchain_mint_status: string | null;
  onchain_tx_hash: string | null;
  onchain_token_id: string | null;
  onchain_minted_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

const COLUMNS = [
  "id",
  "report_message_id",
  "verification_status",
  "moderation_status",
  "reviewed_at",
  "reviewed_by",
  "ai_priority",
  "ai_triage_at",
  "ai_triage_confidence",
  "phone_verification_status",
  "onchain_network",
  "onchain_chain_id",
  "onchain_mint_status",
  "onchain_tx_hash",
  "onchain_token_id",
  "onchain_minted_at",
  "metadata",
  "created_at",
].join(",");

function explorerUrlFor(
  network: string | null,
  txHash: string | null,
): string | undefined {
  if (!txHash) return undefined;
  switch (network) {
    case "skale-base-mainnet":
      return `https://skale-base-explorer.skalenodes.com/tx/${txHash}`;
    case "skale-base-testnet":
      return `https://base-sepolia-testnet-explorer.skalenodes.com/tx/${txHash}`;
    case "base-mainnet":
      return `https://basescan.org/tx/${txHash}`;
    case "base-sepolia":
      return `https://sepolia.basescan.org/tx/${txHash}`;
    default:
      return undefined;
  }
}

function deriveDisplayStatus(row: ReportRow): {
  state: "received" | "reviewing" | "dispatched" | "resolved" | "rejected";
  label: string;
} {
  const verification = (row.verification_status ?? "unverified").toLowerCase();
  const moderation = (row.moderation_status ?? "visible").toLowerCase();
  const aiPriority = (row.ai_priority ?? "pending").toLowerCase();

  if (moderation === "hidden" || aiPriority === "rejected") {
    return { state: "rejected", label: "Closed by operator" };
  }
  if (verification === "verified") {
    return { state: "resolved", label: "Verified" };
  }
  if (row.reviewed_at) {
    return { state: "dispatched", label: "Operator dispatched" };
  }
  if (aiPriority !== "pending") {
    return { state: "reviewing", label: "Under review" };
  }
  return { state: "received", label: "Received" };
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const reportId = params.id;
  if (!reportId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: "Supabase credentials not configured" },
      { status: 500 },
    );
  }

  const anonymousId = request.nextUrl.searchParams.get("anonymousId");

  const apiUrl = new URL(`${url}/rest/v1/disaster_reports`);
  apiUrl.searchParams.set("select", COLUMNS);
  apiUrl.searchParams.set("id", `eq.${reportId}`);
  apiUrl.searchParams.set("limit", "1");

  const res = await fetch(apiUrl.toString(), {
    headers: {
      apikey: serviceKey,
      authorization: `Bearer ${serviceKey}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: `Supabase fetch failed (${res.status})` },
      { status: 502 },
    );
  }

  const rows = (await res.json()) as ReportRow[];
  const row = rows[0];
  if (!row) {
    return NextResponse.json({ error: "Report not found" }, { status: 404 });
  }

  // Ownership check: anonymousId on the report's metadata must match if
  // provided. Skipping the check entirely if anonymousId is omitted keeps the
  // endpoint usable from server-to-server contexts but disclosure here is
  // limited to non-PII display fields.
  if (anonymousId) {
    const metadata = row.metadata ?? {};
    const reportAnon =
      typeof metadata.anonymousId === "string" ? metadata.anonymousId : null;
    if (reportAnon && reportAnon !== anonymousId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const display = deriveDisplayStatus(row);

  return NextResponse.json({
    id: row.id,
    messageId: row.report_message_id ?? undefined,
    status: display.state,
    statusLabel: display.label,
    verificationStatus: row.verification_status ?? "unverified",
    moderationStatus: row.moderation_status ?? "visible",
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
    aiPriority: row.ai_priority,
    aiTriageAt: row.ai_triage_at,
    aiTriageConfidence: row.ai_triage_confidence,
    phoneVerificationStatus: row.phone_verification_status,
    onchain: {
      network: row.onchain_network,
      chainId: row.onchain_chain_id,
      mintStatus: row.onchain_mint_status ?? "not_started",
      txHash: row.onchain_tx_hash,
      tokenId: row.onchain_token_id,
      mintedAt: row.onchain_minted_at,
      explorerUrl: explorerUrlFor(row.onchain_network, row.onchain_tx_hash),
    },
    createdAt: row.created_at,
  });
}
