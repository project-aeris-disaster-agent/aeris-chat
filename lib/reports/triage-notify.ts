/**
 * Real-time hand-off from AERIS CHAT to AERIS DASHBOARD AI triage.
 *
 * After a new disaster report is persisted, we notify the dashboard so the
 * report is classified within seconds instead of waiting for the daily cron.
 *
 * Contract:
 *   POST {AERIS_DASHBOARD_API_BASE_URL}/api/internal/triage
 *   Headers:
 *     content-type: application/json
 *     x-internal-triage-secret: {INTERNAL_TRIAGE_SECRET}
 *   Body: { reportId: string }
 *
 * The call is fire-and-forget: we never block the user response on it, and we
 * surface failures only through server logs. Latency is capped so a slow
 * dashboard cannot starve report inserts.
 */

const DEFAULT_TIMEOUT_MS = 8000;

export function triageNotifyEnabled(): boolean {
  const base = process.env.AERIS_DASHBOARD_API_BASE_URL?.trim();
  const secret = process.env.INTERNAL_TRIAGE_SECRET?.trim();
  return Boolean(base && secret);
}

function getTimeoutMs(): number {
  const raw = Number(process.env.AERIS_TRIAGE_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

/**
 * Notify the dashboard that a single report needs immediate triage.
 *
 * Returns a Promise that always resolves: this helper swallows transport
 * errors so callers can `void notifyTriageForReport(id)` without try/catch.
 * The boolean indicates whether the dashboard accepted the request.
 */
export async function notifyTriageForReport(reportId: string): Promise<boolean> {
  if (!reportId) return false;

  const base = process.env.AERIS_DASHBOARD_API_BASE_URL?.trim();
  const secret = process.env.INTERNAL_TRIAGE_SECRET?.trim();

  if (!base || !secret) {
    return false;
  }

  const url = `${base.replace(/\/+$/, "")}/api/internal/triage`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), getTimeoutMs());

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-internal-triage-secret": secret,
      },
      body: JSON.stringify({ reportId }),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!res.ok) {
      let detail = "";
      try {
        detail = (await res.text()).slice(0, 500);
      } catch {
        detail = "<no body>";
      }
      console.warn(
        `[triage-notify] dashboard rejected reportId=${reportId} status=${res.status} body=${detail}`,
      );
      return false;
    }

    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const name = err instanceof Error ? err.name : "Error";
    console.warn(
      `[triage-notify] failed reportId=${reportId} name=${name} msg=${message}`,
    );
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}
