/**
 * Content moderation guardrail (input + output).
 *
 * Default behavior uses an in-repo deny-list targeting clearly harmful
 * *instruction-seeking* (weapons/explosives how-to, CSAM, instructions to harm
 * oneself or others). The patterns are intentionally narrow so they do NOT
 * fire on legitimate disaster language — words like "trapped", "drowning",
 * "injured", "evacuate", "explosion" (as an event) must pass.
 *
 * An optional external moderation API (OpenAI-compatible) can be enabled via
 * MODERATION_API_URL; when configured it augments the deny-list.
 */

export type ModerationCategory =
  | "weapons"
  | "explosives"
  | "csam"
  | "violence"
  | "self_harm"
  | "external";

export type ModerationVerdict = {
  /** True when the content is allowed to proceed. */
  allowed: boolean;
  category?: ModerationCategory;
  reason?: string;
};

const ALLOWED: ModerationVerdict = { allowed: true };

/**
 * Narrow "how to make/build a weapon or explosive" patterns. We require an
 * instructional verb near the dangerous object so that disaster reports that
 * merely mention an "explosion" or "gun" are not blocked.
 */
const INSTRUCTION_VERB = String.raw`(?:how\s+to\s+(?:make|build|create|assemble|synthesi[sz]e|manufacture)|steps?\s+to\s+(?:make|build)|recipe\s+for|instructions?\s+for\s+(?:making|building))`;

const DENY_RULES: Array<{ category: ModerationCategory; pattern: RegExp; reason: string }> = [
  {
    category: "explosives",
    pattern: new RegExp(
      `${INSTRUCTION_VERB}\\s+(?:a\\s+)?(?:bomb|explosive|ied|pipe\\s*bomb|grenade|molotov|c4|c-4|tnt|detonator|napalm)`,
      "i",
    ),
    reason: "Requests for explosive-device construction are not permitted.",
  },
  {
    category: "weapons",
    pattern: new RegExp(
      `${INSTRUCTION_VERB}\\s+(?:a\\s+)?(?:gun|firearm|rifle|pistol|silencer|suppressor|untraceable\\s+weapon|ghost\\s+gun)`,
      "i",
    ),
    reason: "Requests for weapon manufacturing are not permitted.",
  },
  {
    category: "weapons",
    pattern: /\b(?:synthesi[sz]e|make|produce|cook)\b.{0,30}\b(?:nerve\s+agent|sarin|vx\s+gas|mustard\s+gas|chemical\s+weapon|bioweapon|biological\s+weapon)\b/i,
    reason: "Requests for chemical or biological weapons are not permitted.",
  },
  {
    category: "csam",
    pattern: /\b(?:child|minor|underage|pre-?teen|preteen)\b.{0,40}\b(?:porn|sexual|nude|nudes|naked|explicit)\b/i,
    reason: "Sexual content involving minors is strictly prohibited.",
  },
  {
    category: "csam",
    pattern: /\b(?:porn|sexual|nude|nudes|naked|explicit)\b.{0,40}\b(?:child|minor|underage|pre-?teen|preteen)\b/i,
    reason: "Sexual content involving minors is strictly prohibited.",
  },
  {
    category: "violence",
    pattern: new RegExp(
      `${INSTRUCTION_VERB}?\\s*\\b(?:how\\s+to\\s+)?(?:kill|murder|poison|kidnap|abduct)\\s+(?:a\\s+)?(?:person|someone|people|my\\s+\\w+|him|her|them)\\b`,
      "i",
    ),
    reason: "Requests to plan violence against people are not permitted.",
  },
  {
    category: "self_harm",
    pattern: /\b(?:how\s+to|best\s+way\s+to|easiest\s+way\s+to|painless\s+way\s+to)\b.{0,30}\b(?:kill\s+myself|commit\s+suicide|end\s+my\s+life|hang\s+myself|overdose)\b/i,
    reason: "Self-harm instructions are not permitted.",
  },
];

function denyListScan(text: string): ModerationVerdict {
  if (!text) return ALLOWED;
  for (const rule of DENY_RULES) {
    if (rule.pattern.test(text)) {
      return { allowed: false, category: rule.category, reason: rule.reason };
    }
  }
  return ALLOWED;
}

type OpenAiModerationResponse = {
  results?: Array<{ flagged?: boolean; categories?: Record<string, boolean> }>;
};

/**
 * Optional external moderation. Posts to an OpenAI-compatible
 * /moderations-style endpoint when MODERATION_API_URL is configured. Fails
 * open (returns allowed) on any error so moderation never breaks chat.
 */
async function externalModeration(text: string, signal?: AbortSignal): Promise<ModerationVerdict> {
  const url = process.env.MODERATION_API_URL?.trim();
  if (!url) return ALLOWED;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.MODERATION_API_KEY?.trim()
          ? { Authorization: `Bearer ${process.env.MODERATION_API_KEY.trim()}` }
          : {}),
      },
      body: JSON.stringify({ input: text }),
      signal,
    });
    if (!response.ok) return ALLOWED;
    const data = (await response.json().catch(() => ({}))) as OpenAiModerationResponse;
    const result = data.results?.[0];
    if (result?.flagged) {
      return {
        allowed: false,
        category: "external",
        reason: "This request was flagged by content moderation.",
      };
    }
    return ALLOWED;
  } catch (error) {
    console.error("[guardrails] external moderation error — failing open:", error);
    return ALLOWED;
  }
}

/** Moderate user-supplied input before it reaches the model. */
export async function moderateInput(text: string, signal?: AbortSignal): Promise<ModerationVerdict> {
  const local = denyListScan(text);
  if (!local.allowed) return local;
  return externalModeration(text, signal);
}

/** Moderate model output before it is returned to the user. */
export async function moderateOutput(text: string, signal?: AbortSignal): Promise<ModerationVerdict> {
  // Output is scanned against the same deny-list. External moderation is
  // skipped for output to avoid doubling latency on every reply.
  return denyListScan(text);
}

/** Safe, on-brand refusal shown to the user when input is blocked. */
export function inputRefusalMessage(): string {
  return (
    "I can't help with that request. I'm AERIS, here to help with disaster preparedness, " +
    "safety, and weather in the Philippines.\n\n" +
    "If you're in an emergency, call **911** or the **NDRRMC hotline (02) 8911-1406**. " +
    "How can I help you stay safe?"
  );
}

/** Safe replacement used when model OUTPUT is flagged. */
export function outputFallbackMessage(): string {
  return (
    "I'm sorry — I can't share that. Let's keep things focused on staying safe.\n\n" +
    "If this is an emergency, call **911** or the **NDRRMC hotline (02) 8911-1406**."
  );
}
