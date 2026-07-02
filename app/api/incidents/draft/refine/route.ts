export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { callNvidiaChatCompletion, getNvidiaConfig, type ChatMessage } from "@/lib/nvidia-llm";
import {
  DRAFT_REFINE_SYSTEM_PROMPT,
  buildNextQuestion,
  computeMissingSlots,
  mergeDrafts,
  validateDraft,
  type DraftIncidentReport,
} from "@/lib/incidents/intent";
import {
  getDraftById,
  incidentDraftsEnabled,
  patchDraft,
} from "@/lib/incidents/draft-store";
import {
  checkRateLimit,
  clientRateKey,
  rateLimitRetryAfterSeconds,
} from "@/lib/security/rate-limit";

export async function POST(request: NextRequest) {
  if (!incidentDraftsEnabled()) {
    return NextResponse.json({ error: "incident_drafts not configured" }, { status: 503 });
  }

  let body: { draftId?: unknown; message?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const draftId = typeof body.draftId === "string" ? body.draftId : "";
  const userMessage = typeof body.message === "string" ? body.message.trim() : "";
  if (!draftId) {
    return NextResponse.json({ error: "draftId is required" }, { status: 400 });
  }
  if (!userMessage) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }
  if (userMessage.length > 4000) {
    return NextResponse.json({ error: "message too long" }, { status: 413 });
  }

  const refineLimit = checkRateLimit(clientRateKey("incident-refine", request), {
    windowMs: 60_000,
    max: 12,
  });
  if (!refineLimit.allowed) {
    return NextResponse.json(
      { error: "Too many refine requests. Please wait a moment." },
      {
        status: 429,
        headers: { "retry-after": String(rateLimitRetryAfterSeconds(refineLimit)) },
      },
    );
  }

  const existing = await getDraftById(draftId);
  if (!existing) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }
  if (existing.status !== "open") {
    return NextResponse.json(
      { error: `Draft is ${existing.status}; cannot refine` },
      { status: 409 },
    );
  }

  const config = getNvidiaConfig();
  if (!config) {
    return NextResponse.json(
      { error: "NVIDIA_API_KEY is not configured." },
      { status: 503 },
    );
  }

  const messages: ChatMessage[] = [
    { role: "system", content: DRAFT_REFINE_SYSTEM_PROMPT },
    {
      role: "user",
      content: `Prior draft JSON:\n${JSON.stringify(existing.draft)}\n\nLatest user message:\n${userMessage}`,
    },
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
      return NextResponse.json({ error: "Refine timed out." }, { status: 504 });
    }
    return NextResponse.json(
      { error: error?.message || "Failed to refine draft." },
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

  const candidate = validateDraft(parsed);
  if (!candidate) {
    return NextResponse.json({ error: "Refined draft failed validation." }, { status: 502 });
  }

  // If the model signals cancellation, mark the draft cancelled.
  if (candidate.description.length === 0 || candidate.confidence === 0) {
    const cancelled = await patchDraft(draftId, { status: "cancelled" });
    return NextResponse.json({
      cancelled: true,
      draft: cancelled,
    });
  }

  const merged: DraftIncidentReport = mergeDrafts(existing.draft, candidate);
  const missingSlots = computeMissingSlots(merged);
  const nextQuestion = buildNextQuestion(missingSlots);

  const updated = await patchDraft(draftId, {
    draft: merged,
    missingSlots,
    nextQuestion,
  });

  return NextResponse.json({
    draft: updated,
    missingSlots,
    nextQuestion,
  });
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
