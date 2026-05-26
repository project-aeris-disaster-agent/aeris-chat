"use client";

import React from "react";
import { AlertTriangle, CheckCircle2, Loader2, MapPin, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAnonymousSessionId } from "@/lib/utils/anonymous-session";
import {
  DRAFT_CATEGORIES,
  type DraftCategory,
  type DraftIncidentReport,
} from "@/lib/incidents/intent";

const CATEGORY_LABELS: Record<DraftCategory, string> = {
  flood: "Flood",
  landslide: "Landslide",
  stranded: "Stranded / Rescue Needed",
  SOS: "SOS / Life Threat",
  infra_damage: "Infrastructure Damage",
  power_out: "Power Outage",
  road_closed: "Road Closed",
};

const IP_LOCATION_ACCURACY_M = 25000;

type DetectedLocation = {
  position: [number, number];
  accuracyM?: number;
  source: "browser" | "ip";
  label: string;
  metadata: Record<string, unknown>;
};

async function getBrowserLocation(): Promise<DetectedLocation | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const longitude = Number(position.coords.longitude.toFixed(6));
        const latitude = Number(position.coords.latitude.toFixed(6));
        resolve({
          position: [longitude, latitude],
          accuracyM: Math.round(position.coords.accuracy),
          source: "browser",
          label: "Precise device location detected",
          metadata: {
            geolocation: { source: "browser", accuracyM: Math.round(position.coords.accuracy) },
          },
        });
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  });
}

type SystemMessagePayload = {
  sessionId: string;
  role: "assistant" | "system";
  content: string;
  metadata: Record<string, unknown>;
};

async function postSystemMessage(payload: SystemMessagePayload): Promise<void> {
  try {
    await fetch("/api/chat/system-message", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...payload,
        anonymousId: getAnonymousSessionId(),
      }),
    });
  } catch {
    // Best-effort: never block the UI on the ack write.
  }
}

function buildAckContent(input: {
  urgent: boolean;
  reportMessageId: string | undefined;
  category: string;
}): string {
  const idTag = input.reportMessageId ? ` (ref: ${input.reportMessageId})` : "";
  if (input.urgent) {
    return [
      `AERIS received your URGENT report${idTag}.`,
      "Operators have been notified and your incident has been broadcast to the response panel.",
      "Stay where you are if it is safe. Reply here with any update.",
    ].join(" ");
  }
  return [
    `AERIS received your ${input.category} report${idTag}.`,
    "It has been queued for review. You will see status updates here.",
  ].join(" ");
}

async function getIpLocation(): Promise<DetectedLocation | null> {
  try {
    const res = await fetch("/api/location", { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    const longitude = Number(data.position?.[0]);
    const latitude = Number(data.position?.[1]);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
    return {
      position: [longitude, latitude],
      accuracyM: typeof data.accuracyM === "number" ? data.accuracyM : IP_LOCATION_ACCURACY_M,
      source: "ip",
      label: typeof data.label === "string" && data.label ? data.label : "Approximate IP location detected",
      metadata: typeof data.metadata === "object" && data.metadata ? data.metadata : {},
    };
  } catch {
    return null;
  }
}

export type IncidentDraftCardStatus =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "submitted"; reportId: string; messageId?: string }
  | { kind: "cancelled" }
  | { kind: "error"; message: string };

export type ReportLifeCycleStatus = {
  state: "received" | "reviewing" | "dispatched" | "resolved" | "rejected";
  label: string;
  aiPriority?: string | null;
  onchainMintStatus?: string | null;
  onchainTxHash?: string | null;
  explorerUrl?: string | null;
};

type IncidentDraftCardProps = {
  draft: DraftIncidentReport;
  sessionId: string | null;
  /** Persisted final status of this draft. Once non-idle the card is read-only. */
  initialStatus?: IncidentDraftCardStatus;
  /** Called whenever the persisted status changes (parent should persist to storage). */
  onStatusChange?: (status: IncidentDraftCardStatus) => void;
  /** Slots still missing - when present, the card shows the clarification question instead of the confirm panel. */
  missingSlots?: string[];
  nextQuestion?: string | null;
  /** Persisted draft id (for refine API). */
  draftId?: string;
  /** Called when the user provides an answer to the clarification question. */
  onRefine?: (draftId: string, answer: string) => Promise<void> | void;
};

export function IncidentDraftCard({
  draft,
  sessionId,
  initialStatus,
  onStatusChange,
  missingSlots,
  nextQuestion,
  draftId,
  onRefine,
}: IncidentDraftCardProps) {
  const [refineAnswer, setRefineAnswer] = React.useState("");
  const [refining, setRefining] = React.useState(false);
  const needsClarification = (missingSlots?.length ?? 0) > 0;
  const [editing, setEditing] = React.useState(false);
  const [category, setCategory] = React.useState<DraftCategory>(draft.category);
  const [description, setDescription] = React.useState(draft.description);
  const [locationHint, setLocationHint] = React.useState(draft.locationHint ?? "");
  const [status, setStatus] = React.useState<IncidentDraftCardStatus>(initialStatus ?? { kind: "idle" });
  const [lifecycle, setLifecycle] = React.useState<ReportLifeCycleStatus | null>(null);

  const updateStatus = React.useCallback(
    (next: IncidentDraftCardStatus) => {
      setStatus(next);
      onStatusChange?.(next);
    },
    [onStatusChange],
  );

  const isTerminalOrBusy =
    status.kind === "submitted" || status.kind === "cancelled" || status.kind === "submitting";

  // Phase 4.4: poll /api/reports/[id]/status for up to 5 minutes after the
  // user confirms the report. Stops early if we reach a terminal state
  // (resolved/rejected/minted) or if the report transitions on-chain.
  React.useEffect(() => {
    if (status.kind !== "submitted") return;
    const reportId = status.reportId;
    if (!reportId || reportId === "unknown") return;

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const startedAt = Date.now();
    const maxDurationMs = 5 * 60 * 1000;

    const tick = async () => {
      if (cancelled) return;
      try {
        const url = `/api/reports/${reportId}/status?anonymousId=${encodeURIComponent(getAnonymousSessionId())}`;
        const res = await fetch(url, { cache: "no-store" });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data && !cancelled) {
            const next: ReportLifeCycleStatus = {
              state: data.status,
              label: data.statusLabel,
              aiPriority: data.aiPriority,
              onchainMintStatus: data?.onchain?.mintStatus ?? null,
              onchainTxHash: data?.onchain?.txHash ?? null,
              explorerUrl: data?.onchain?.explorerUrl ?? null,
            };
            setLifecycle(next);

            const onChainDone =
              next.onchainMintStatus === "minted" ||
              next.onchainMintStatus === "failed";
            const terminal =
              next.state === "resolved" ||
              next.state === "rejected" ||
              (next.state === "dispatched" && onChainDone);
            if (terminal) return;
          }
        }
      } catch {
        // Network errors: continue polling.
      }
      if (cancelled) return;
      if (Date.now() - startedAt > maxDurationMs) return;
      timeoutId = setTimeout(tick, 15_000);
    };

    void tick();

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [status]);

  const handleCancel = () => {
    if (isTerminalOrBusy) return;
    updateStatus({ kind: "cancelled" });
  };

  const handleConfirm = async () => {
    if (isTerminalOrBusy) return;
    updateStatus({ kind: "submitting" });

    const browser = await getBrowserLocation();
    const detected = browser ?? (await getIpLocation());
    if (!detected) {
      updateStatus({
        kind: "error",
        message: "Could not detect a location for this report. Open the report form to set it manually.",
      });
      return;
    }

    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category,
          description: description.trim(),
          position: detected.position,
          locationAccuracyM: detected.accuracyM,
          anonymousId: getAnonymousSessionId(),
          sessionId: sessionId ?? undefined,
          metadata: {
            ...detected.metadata,
            source: "chat_agent_draft",
            agentDraft: {
              urgent: draft.urgent,
              suggestedSeverity: draft.suggestedSeverity,
              confidence: draft.confidence,
              locationHint: locationHint.trim() || draft.locationHint,
            },
          },
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = typeof body?.error === "string" ? body.error : `Report failed (${response.status})`;
        updateStatus({ kind: "error", message });
        return;
      }

      const report = body?.report ?? {};
      const reportId = typeof report.id === "string" ? report.id : "unknown";
      const reportMessageId =
        typeof report.messageId === "string" ? report.messageId : undefined;

      updateStatus({
        kind: "submitted",
        reportId,
        messageId: reportMessageId,
      });

      // Fire-and-forget chat-thread acknowledgements (Phase 4.1 + 4.2).
      if (sessionId) {
        void postSystemMessage({
          sessionId,
          role: "assistant",
          content: buildAckContent({
            urgent: draft.urgent,
            reportMessageId,
            category,
          }),
          metadata: {
            kind: "ack",
            reportId,
            reportMessageId,
            urgent: draft.urgent,
            category,
          },
        });

        if (draft.urgent) {
          void postSystemMessage({
            sessionId,
            role: "assistant",
            content:
              "While responders are mobilising, please tap the actions below.",
            metadata: {
              kind: "urgent-followup",
              reportId,
              reportMessageId,
              actions: ["hotlines", "verify_phone", "status_update"],
            },
          });
        }
      }
    } catch (err) {
      updateStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Failed to submit report.",
      });
    }
  };

  const severityClass =
    draft.suggestedSeverity === "critical" || draft.urgent
      ? "border-red-500/70 bg-red-500/10"
      : draft.suggestedSeverity === "high"
        ? "border-orange-500/60 bg-orange-500/10"
        : "border-yellow-500/50 bg-yellow-500/10";

  return (
    <div
      className={`my-2 max-w-3xl rounded-lg border-2 ${severityClass} p-4 text-black dark:text-white`}
      role="region"
      aria-label="AERIS proposed incident report"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle
          className={`mt-0.5 h-5 w-5 flex-shrink-0 ${
            draft.urgent ? "text-red-600 dark:text-red-400" : "text-yellow-600 dark:text-yellow-400"
          }`}
        />
        <div className="flex-1">
          <p className="text-sm font-semibold uppercase tracking-wide">
            AERIS detected a possible incident
            {draft.urgent && (
              <span className="ml-2 rounded-md bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                URGENT
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs opacity-70">
            Severity: {draft.suggestedSeverity} · Confidence: {(draft.confidence * 100).toFixed(0)}%
          </p>
        </div>
      </div>

      <div className="mt-3 space-y-3 text-sm">
        {editing ? (
          <>
            <label className="block">
              <span className="text-xs font-semibold opacity-80">Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as DraftCategory)}
                disabled={isTerminalOrBusy}
                className="mt-1 block w-full rounded-md border border-black/20 bg-white/70 px-2 py-1.5 text-sm dark:border-white/20 dark:bg-black/40"
              >
                {DRAFT_CATEGORIES.map((value) => (
                  <option key={value} value={value}>
                    {CATEGORY_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold opacity-80">Description</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={isTerminalOrBusy}
                rows={3}
                className="mt-1 block w-full rounded-md border border-black/20 bg-white/70 px-2 py-1.5 text-sm dark:border-white/20 dark:bg-black/40"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold opacity-80">Location hint (optional)</span>
              <Input
                value={locationHint}
                onChange={(e) => setLocationHint(e.target.value)}
                disabled={isTerminalOrBusy}
                placeholder="e.g. Marikina, near Nangka bridge"
                className="mt-1"
              />
            </label>
          </>
        ) : (
          <>
            <p>
              <span className="font-semibold">{CATEGORY_LABELS[category]}</span> · {description}
            </p>
            {locationHint && (
              <p className="flex items-center gap-1 text-xs opacity-80">
                <MapPin className="h-3 w-3" />
                {locationHint}
              </p>
            )}
          </>
        )}
      </div>

      {status.kind === "error" && (
        <p className="mt-3 rounded-md bg-red-500/15 px-2 py-1.5 text-xs text-red-700 dark:text-red-300">
          {status.message}
        </p>
      )}
      {status.kind === "submitted" && (
        <div className="mt-3 space-y-2">
          <p className="flex items-center gap-1 rounded-md bg-emerald-500/15 px-2 py-1.5 text-xs text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Report submitted to AERIS (id: {status.reportId.slice(0, 8)})
          </p>
          {lifecycle && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span
                className={`rounded-md px-2 py-0.5 font-semibold ${
                  lifecycle.state === "resolved"
                    ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                    : lifecycle.state === "dispatched"
                      ? "bg-sky-500/20 text-sky-700 dark:text-sky-300"
                      : lifecycle.state === "rejected"
                        ? "bg-zinc-500/20 text-zinc-700 dark:text-zinc-300"
                        : lifecycle.state === "reviewing"
                          ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                          : "bg-blue-500/20 text-blue-700 dark:text-blue-300"
                }`}
              >
                {lifecycle.label}
              </span>
              {lifecycle.onchainMintStatus && lifecycle.onchainMintStatus !== "not_started" && (
                <span className="rounded-md bg-purple-500/15 px-2 py-0.5 font-mono text-purple-700 dark:text-purple-300">
                  on-chain: {lifecycle.onchainMintStatus}
                </span>
              )}
              {lifecycle.explorerUrl && (
                <a
                  href={lifecycle.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-md bg-purple-500/15 px-2 py-0.5 font-mono text-purple-700 underline dark:text-purple-300"
                >
                  view on-chain
                </a>
              )}
            </div>
          )}
        </div>
      )}
      {status.kind === "cancelled" && (
        <p className="mt-3 rounded-md bg-black/10 px-2 py-1.5 text-xs opacity-70 dark:bg-white/10">
          Draft dismissed. You can still file the report manually from the report form.
        </p>
      )}

      {status.kind !== "submitted" &&
        status.kind !== "cancelled" &&
        needsClarification &&
        nextQuestion && (
          <div className="mt-4 rounded-md border border-dashed border-yellow-500/60 bg-yellow-500/10 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-yellow-700 dark:text-yellow-300">
              One more detail
            </p>
            <p className="mt-1 text-sm">{nextQuestion}</p>
            <form
              className="mt-2 flex items-center gap-2"
              onSubmit={async (e) => {
                e.preventDefault();
                if (!draftId || !onRefine) return;
                const answer = refineAnswer.trim();
                if (!answer) return;
                setRefining(true);
                try {
                  await onRefine(draftId, answer);
                  setRefineAnswer("");
                } finally {
                  setRefining(false);
                }
              }}
            >
              <Input
                value={refineAnswer}
                onChange={(e) => setRefineAnswer(e.target.value)}
                placeholder="Your answer"
                disabled={refining || !draftId || !onRefine}
              />
              <Button
                type="submit"
                size="sm"
                disabled={refining || refineAnswer.trim().length === 0 || !draftId || !onRefine}
              >
                {refining ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  "Send"
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleCancel}
                disabled={refining}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </form>
            <p className="mt-2 text-[10px] text-yellow-700/70 dark:text-yellow-300/70">
              You can also click <strong>Confirm &amp; send report</strong> below to submit without
              this detail.
            </p>
          </div>
        )}

      {status.kind !== "submitted" && status.kind !== "cancelled" && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={status.kind === "submitting" || description.trim().length < 4}
            className={
              draft.urgent
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-yellow-500 text-black hover:bg-yellow-600"
            }
          >
            {status.kind === "submitting" ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                Submitting…
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                Confirm &amp; send report
              </>
            )}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setEditing((v) => !v)}
            disabled={status.kind === "submitting"}
          >
            <Pencil className="mr-1.5 h-3.5 w-3.5" />
            {editing ? "Done editing" : "Edit"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={handleCancel}
            disabled={status.kind === "submitting"}
          >
            <X className="mr-1.5 h-3.5 w-3.5" />
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
