export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { callNvidiaChatCompletion, getNvidiaConfig, type ChatMessage } from "@/lib/nvidia-llm";
import {
  DRAFT_SYSTEM_PROMPT,
  buildNextQuestion,
  computeMissingSlots,
  detectIncidentIntent,
  validateDraft,
  type DraftIncidentReport,
  type DraftSlot,
} from "@/lib/incidents/intent";
import {
  incidentDraftsEnabled,
  insertDraft,
  type IncidentDraftRow,
} from "@/lib/incidents/draft-store";
import {
  checkRateLimit,
  clientRateKey,
  rateLimitRetryAfterSeconds,
} from "@/lib/security/rate-limit";
import { resolveAnonId } from "@/lib/security/anon-identity";

type DraftResponse = {
  matched: boolean;
  draft: DraftIncidentReport | null;
  missingSlots: DraftSlot[];
  nextQuestion: string | null;
  draftId?: string;
  persisted: boolean;
  signals: string[];
  provider?: string;
  model?: string;
};

export async function POST(request: NextRequest) {
  let body: {
    message?: unknown;
    sessionId?: unknown;
    userMessageId?: unknown;
    anonymousId?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const sessionId = typeof body.sessionId === "string" ? body.sessionId : "";
  const userMessageId =
    typeof body.userMessageId === "string" ? body.userMessageId : "";
  const anonymousId = await resolveAnonId(
    typeof body.anonymousId === "string" ? body.anonymousId : undefined,
  );

  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }
  if (message.length > 4000) {
    return NextResponse.json({ error: "message too long" }, { status: 413 });
  }

  const draftLimit = checkRateLimit(clientRateKey("incident-draft", request, anonymousId), {
    windowMs: 60_000,
    max: 8,
  });
  if (!draftLimit.allowed) {
    return NextResponse.json(
      { error: "Too many drafting requests. Please wait a moment." },
      {
        status: 429,
        headers: { "retry-after": String(rateLimitRetryAfterSeconds(draftLimit)) },
      },
    );
  }

  const intent = detectIncidentIntent(message);
  if (!intent.match) {
    const payload: DraftResponse = {
      matched: false,
      draft: null,
      missingSlots: [],
      nextQuestion: null,
      persisted: false,
      signals: intent.signals,
    };
    return NextResponse.json(payload);
  }

  const config = getNvidiaConfig();
  if (!config) {
    return NextResponse.json(
      { error: "NVIDIA_API_KEY is not configured; cannot draft incident reports." },
      { status: 503 },
    );
  }

  const messages: ChatMessage[] = [
    { role: "system", content: DRAFT_SYSTEM_PROMPT },
    { role: "user", content: message },
  ];

  const controller = new AbortController();
  const timeoutMs = Number(process.env.INCIDENT_DRAFT_TIMEOUT_MS ?? "20000");
  const timeoutId = setTimeout(
    () => controller.abort(),
    Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 20000,
  );

  let raw: string;
  try {
    raw = await callNvidiaChatCompletion(messages, {
      signal: controller.signal,
      temperature: 0.1,
      maxTokens: 512,
      jsonMode: true,
    });
  } catch (err) {
    clearTimeout(timeoutId);
    const error = err as { name?: string; message?: string };
    if (error?.name === "AbortError") {
      return NextResponse.json({ error: "Draft timed out." }, { status: 504 });
    }
    return NextResponse.json(
      { error: error?.message || "Failed to draft incident." },
      { status: 502 },
    );
  }
  clearTimeout(timeoutId);

  const parsed = safeParseJson(raw);
  if (!parsed) {
    return NextResponse.json(
      { error: "Model did not return valid JSON.", raw },
      { status: 502 },
    );
  }

  const draft = validateDraft(parsed);
  if (!draft || draft.description.length === 0) {
    const payload: DraftResponse = {
      matched: false,
      draft: null,
      missingSlots: [],
      nextQuestion: null,
      persisted: false,
      signals: [...intent.signals, "llm-rejected"],
      provider: "nvidia",
      model: config.model,
    };
    return NextResponse.json(payload);
  }

  if (intent.urgent && !draft.urgent) {
    draft.urgent = true;
    if (draft.suggestedSeverity === "low" || draft.suggestedSeverity === "medium") {
      draft.suggestedSeverity = "high";
    }
  }

  const missingSlots = computeMissingSlots(draft);
  const nextQuestion = buildNextQuestion(missingSlots);

  let persisted = false;
  let draftRow: IncidentDraftRow | null = null;
  if (sessionId && userMessageId && incidentDraftsEnabled()) {
    draftRow = await insertDraft({
      sessionId,
      userMessageId,
      anonymousId: anonymousId || undefined,
      draft,
      missingSlots,
      nextQuestion,
    });
    persisted = Boolean(draftRow);
  }

  const payload: DraftResponse = {
    matched: true,
    draft,
    missingSlots,
    nextQuestion,
    draftId: draftRow?.id,
    persisted,
    signals: intent.signals,
    provider: "nvidia",
    model: config.model,
  };
  return NextResponse.json(payload);
}

function safeParseJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}
