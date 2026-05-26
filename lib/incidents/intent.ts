/**
 * Lightweight, deterministic heuristics for deciding whether a chat
 * message describes an in-progress incident worth offering to file as
 * a report. Runs *before* any LLM call so the bot doesn't ask for a
 * draft on greetings, jokes, or general questions.
 *
 * If `detectIncidentIntent` returns `match: true`, the chat client
 * should call POST /api/incidents/draft to ask the LLM to produce a
 * structured DraftIncidentReport.
 */

const INCIDENT_VERBS = [
  "flooding",
  "flooded",
  "flood",
  "drowning",
  "drown",
  "stranded",
  "stuck",
  "trapped",
  "submerged",
  "collapsed",
  "collapse",
  "landslide",
  "landslip",
  "mudslide",
  "evacuat",
  "rescue",
  "blackout",
  "no power",
  "power out",
  "power outage",
  "road closed",
  "road blocked",
  "blocked road",
  "fire",
  "burning",
  "injured",
  "bleeding",
  "missing",
  "lost contact",
  "help",
  "sos",
  "emergency",
  "tulong",
  "baha",
  "binabaha",
  "naipit",
  "nasunog",
  "sumalanta",
  "guho",
  "guhuin",
  "nawalan ng kuryente",
];

const URGENT_KEYWORDS = [
  "sos",
  "rescue",
  "drowning",
  "trapped",
  "stuck",
  "stuck on roof",
  "stranded",
  "bleeding",
  "unconscious",
  "missing",
  "dying",
  "no air",
  "can't breathe",
  "running out",
  "rising fast",
  "submerged",
  "trapped inside",
  "trapped in",
  "collapsed",
  "fire spreading",
  "help us",
  "help me",
  "tulong",
  "saklolo",
  "tulungan",
  "nalulunod",
  "namamatay",
  "naipit",
];

export type IntentMatch = {
  /** True if the message likely describes an ongoing incident. */
  match: boolean;
  /** True if any urgency keywords were present (used as a strong prior for triage). */
  urgent: boolean;
  /** The first-person markers that were found (debug aid). */
  signals: string[];
};

const FIRST_PERSON_MARKERS = [
  " i ",
  " i'm ",
  " im ",
  " my ",
  " we ",
  " we're ",
  " were ",
  " our ",
  " us ",
  " kami ",
  " ako ",
  " tayo ",
  " amin ",
];

export function detectIncidentIntent(rawMessage: string): IntentMatch {
  const message = ` ${rawMessage.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, " ").replace(/\s+/g, " ")} `;
  const signals: string[] = [];

  const verbHit = INCIDENT_VERBS.find((kw) => message.includes(` ${kw}`) || message.includes(`${kw} `));
  if (!verbHit) {
    return { match: false, urgent: false, signals };
  }
  signals.push(`verb:${verbHit}`);

  const firstPerson = FIRST_PERSON_MARKERS.some((marker) => message.includes(marker));
  if (firstPerson) signals.push("first-person");

  const isQuestion = /\?\s*$/.test(rawMessage.trim()) || /^(what|how|why|when|where|kailan|paano|bakit)\b/i.test(rawMessage.trim());

  const urgentHit = URGENT_KEYWORDS.find((kw) => message.includes(` ${kw}`) || message.includes(`${kw} `));
  if (urgentHit) signals.push(`urgent:${urgentHit}`);

  const match = firstPerson || Boolean(urgentHit) || !isQuestion;

  return {
    match,
    urgent: Boolean(urgentHit),
    signals,
  };
}

export const DRAFT_CATEGORIES = [
  "flood",
  "landslide",
  "stranded",
  "SOS",
  "infra_damage",
  "power_out",
  "road_closed",
] as const;

export type DraftCategory = (typeof DRAFT_CATEGORIES)[number];

export type DraftIncidentReport = {
  category: DraftCategory;
  description: string;
  urgent: boolean;
  suggestedSeverity: "low" | "medium" | "high" | "critical";
  locationHint: string | null;
  /**
   * Approximate number of people directly affected by the incident. null
   * means the model could not infer it and the agent should ask.
   */
  peopleAffected: number | null;
  confidence: number;
};

/** Slots the agent must collect before showing the IncidentDraftCard. */
export const REQUIRED_SLOTS = [
  "category",
  "description",
  "locationHint",
  "peopleAffected",
] as const;

export type DraftSlot = (typeof REQUIRED_SLOTS)[number];

export function computeMissingSlots(draft: DraftIncidentReport): DraftSlot[] {
  const missing: DraftSlot[] = [];
  if (!draft.category) missing.push("category");
  if (!draft.description || draft.description.trim().length < 4) {
    missing.push("description");
  }
  if (!draft.locationHint || draft.locationHint.trim().length < 2) {
    missing.push("locationHint");
  }
  if (draft.peopleAffected === null || draft.peopleAffected === undefined) {
    missing.push("peopleAffected");
  }
  return missing;
}

const SLOT_QUESTIONS: Record<DraftSlot, string> = {
  category:
    "What kind of incident is this? (flood, landslide, stranded, SOS, infra damage, power outage, road closed)",
  description:
    "Can you describe what is happening in one or two sentences?",
  locationHint:
    "Where is this happening? A barangay, landmark, or street name helps responders.",
  peopleAffected:
    "About how many people are with you or affected right now?",
};

export function buildNextQuestion(missing: DraftSlot[]): string | null {
  if (missing.length === 0) return null;
  return SLOT_QUESTIONS[missing[0]];
}

export function isDraftCategory(value: unknown): value is DraftCategory {
  return typeof value === "string" && (DRAFT_CATEGORIES as readonly string[]).includes(value);
}

export function validateDraft(value: unknown): DraftIncidentReport | null {
  if (!value || typeof value !== "object") return null;
  const r = value as Record<string, unknown>;

  if (!isDraftCategory(r.category)) return null;
  if (typeof r.description !== "string" || r.description.trim().length < 4) return null;

  const severity = r.suggestedSeverity;
  if (severity !== "low" && severity !== "medium" && severity !== "high" && severity !== "critical") {
    return null;
  }

  const urgent = Boolean(r.urgent) || severity === "critical";
  const locationHint =
    typeof r.locationHint === "string" && r.locationHint.trim().length > 0
      ? r.locationHint.trim().slice(0, 200)
      : null;

  const confidenceRaw = typeof r.confidence === "number" ? r.confidence : Number(r.confidence);
  const confidence = Number.isFinite(confidenceRaw) ? Math.min(1, Math.max(0, confidenceRaw)) : 0.5;

  let peopleAffected: number | null = null;
  if (r.peopleAffected === null || r.peopleAffected === undefined || r.peopleAffected === "") {
    peopleAffected = null;
  } else {
    const n =
      typeof r.peopleAffected === "number"
        ? r.peopleAffected
        : Number(r.peopleAffected);
    if (Number.isFinite(n) && n >= 0 && n < 1_000_000) {
      peopleAffected = Math.round(n);
    }
  }

  return {
    category: r.category,
    description: r.description.trim().slice(0, 1000),
    urgent,
    suggestedSeverity: severity,
    locationHint,
    peopleAffected,
    confidence,
  };
}

export function mergeDrafts(
  prior: DraftIncidentReport,
  next: DraftIncidentReport,
): DraftIncidentReport {
  return {
    category: next.category ?? prior.category,
    description:
      next.description && next.description.trim().length > 0
        ? next.description
        : prior.description,
    urgent: next.urgent || prior.urgent,
    suggestedSeverity:
      severityRank(next.suggestedSeverity) >= severityRank(prior.suggestedSeverity)
        ? next.suggestedSeverity
        : prior.suggestedSeverity,
    locationHint:
      next.locationHint && next.locationHint.trim().length > 0
        ? next.locationHint
        : prior.locationHint,
    peopleAffected:
      next.peopleAffected !== null && next.peopleAffected !== undefined
        ? next.peopleAffected
        : prior.peopleAffected,
    confidence: Math.max(next.confidence, prior.confidence),
  };
}

function severityRank(s: DraftIncidentReport["suggestedSeverity"]): number {
  switch (s) {
    case "low":
      return 0;
    case "medium":
      return 1;
    case "high":
      return 2;
    case "critical":
      return 3;
    default:
      return 0;
  }
}

export const DRAFT_SYSTEM_PROMPT = `You are A.E.R.I.S., a disaster-response assistant for the Philippines.
A user has typed a message in chat. Your job is to extract a structured
disaster-incident report from that message.

Return ONLY a JSON object that matches this schema (no prose, no markdown):
{
  "category": one of ["flood","landslide","stranded","SOS","infra_damage","power_out","road_closed"],
  "description": short third-person summary, max 400 chars, factual only,
  "urgent": boolean (true if life-threatening or immediate rescue needed),
  "suggestedSeverity": one of ["low","medium","high","critical"],
  "locationHint": short location string the user mentioned (e.g. "Marikina, near Nangka bridge"), or null,
  "peopleAffected": integer number of people directly affected if the user mentioned it (e.g. "family of 4" -> 4), otherwise null,
  "confidence": number between 0 and 1
}

Rules:
- If the message is NOT describing a real-world ongoing incident, return
  {"category":"flood","description":"","urgent":false,"suggestedSeverity":"low","locationHint":null,"peopleAffected":null,"confidence":0}
  (an empty description signals "no draft").
- Pick "SOS" only when there is direct threat to life (drowning, trapped, bleeding, etc).
- "stranded" = person/people stuck and need rescue but not immediate life threat.
- Never invent locations or numbers the user didn't mention. Use null when unsure.
- Always reply in English regardless of input language.`;

export const DRAFT_REFINE_SYSTEM_PROMPT = `You are A.E.R.I.S., refining an in-progress disaster incident draft.
You will be given the prior draft JSON and the user's latest message. Merge
new information into the draft and return ONLY the updated JSON object,
matching the same schema as the initial extraction.

Rules:
- Preserve existing non-null fields unless the user clearly corrects them.
- Use the new message to fill missing slots (locationHint, peopleAffected, etc.).
- If the user says "cancel" or "never mind" or similar, set description to "" and confidence to 0.
- Never invent details the user did not provide.`;
