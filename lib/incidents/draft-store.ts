/**
 * Server-side persistence layer for incident drafts (Phase 5.1).
 *
 * Uses the Supabase service-role REST API so it works in route handlers
 * without needing the cookies-based client (which is per-request).
 */

import type { DraftIncidentReport } from "./intent";

export type DraftStatus = "open" | "confirmed" | "cancelled" | "expired";

export type IncidentDraftRow = {
  id: string;
  session_id: string;
  user_message_id: string;
  anonymous_id: string | null;
  draft: DraftIncidentReport;
  missing_slots: string[];
  next_question: string | null;
  status: DraftStatus;
  confirmed_report_id: string | null;
  created_at: string;
  updated_at: string;
};

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  return { url, serviceKey };
}

function headers(serviceKey: string) {
  return {
    apikey: serviceKey,
    authorization: `Bearer ${serviceKey}`,
    "content-type": "application/json",
  };
}

const COLUMNS =
  "id,session_id,user_message_id,anonymous_id,draft,missing_slots,next_question,status,confirmed_report_id,created_at,updated_at";

export function incidentDraftsEnabled(): boolean {
  return config() !== null;
}

export async function listOpenDraftsForSession(
  sessionId: string,
): Promise<IncidentDraftRow[]> {
  const cfg = config();
  if (!cfg) return [];
  const url = new URL(`${cfg.url}/rest/v1/incident_drafts`);
  url.searchParams.set("select", COLUMNS);
  url.searchParams.set("session_id", `eq.${sessionId}`);
  url.searchParams.set("order", "created_at.desc");
  url.searchParams.set("limit", "20");

  const res = await fetch(url.toString(), {
    headers: headers(cfg.serviceKey),
    cache: "no-store",
  });
  if (!res.ok) return [];
  return (await res.json()) as IncidentDraftRow[];
}

export async function getDraftById(
  id: string,
): Promise<IncidentDraftRow | null> {
  const cfg = config();
  if (!cfg) return null;
  const url = new URL(`${cfg.url}/rest/v1/incident_drafts`);
  url.searchParams.set("select", COLUMNS);
  url.searchParams.set("id", `eq.${id}`);
  url.searchParams.set("limit", "1");

  const res = await fetch(url.toString(), {
    headers: headers(cfg.serviceKey),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const rows = (await res.json()) as IncidentDraftRow[];
  return rows[0] ?? null;
}

export type InsertDraftInput = {
  sessionId: string;
  userMessageId: string;
  anonymousId?: string;
  draft: DraftIncidentReport;
  missingSlots: string[];
  nextQuestion?: string | null;
};

export async function insertDraft(
  input: InsertDraftInput,
): Promise<IncidentDraftRow | null> {
  const cfg = config();
  if (!cfg) return null;

  const res = await fetch(
    `${cfg.url}/rest/v1/incident_drafts?select=${COLUMNS}`,
    {
      method: "POST",
      headers: { ...headers(cfg.serviceKey), prefer: "return=representation" },
      body: JSON.stringify({
        session_id: input.sessionId,
        user_message_id: input.userMessageId,
        anonymous_id: input.anonymousId ?? null,
        draft: input.draft,
        missing_slots: input.missingSlots,
        next_question: input.nextQuestion ?? null,
        status: "open",
      }),
    },
  );

  if (!res.ok) return null;
  const rows = (await res.json()) as IncidentDraftRow[];
  return rows[0] ?? null;
}

export type UpdateDraftPatch = {
  draft?: DraftIncidentReport;
  missingSlots?: string[];
  nextQuestion?: string | null;
  status?: DraftStatus;
  confirmedReportId?: string | null;
};

export async function patchDraft(
  id: string,
  patch: UpdateDraftPatch,
): Promise<IncidentDraftRow | null> {
  const cfg = config();
  if (!cfg) return null;

  const payload: Record<string, unknown> = {};
  if (patch.draft) payload.draft = patch.draft;
  if (patch.missingSlots) payload.missing_slots = patch.missingSlots;
  if (patch.nextQuestion !== undefined) payload.next_question = patch.nextQuestion;
  if (patch.status) payload.status = patch.status;
  if (patch.confirmedReportId !== undefined) {
    payload.confirmed_report_id = patch.confirmedReportId;
  }

  if (Object.keys(payload).length === 0) return null;

  const url = new URL(`${cfg.url}/rest/v1/incident_drafts`);
  url.searchParams.set("id", `eq.${id}`);
  url.searchParams.set("select", COLUMNS);

  const res = await fetch(url.toString(), {
    method: "PATCH",
    headers: { ...headers(cfg.serviceKey), prefer: "return=representation" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) return null;
  const rows = (await res.json()) as IncidentDraftRow[];
  return rows[0] ?? null;
}
