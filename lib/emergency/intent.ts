/**
 * Detects requests for emergency reference info (hotlines / evacuation
 * centers) so the chat route can prefetch verified data into LIVE_CONTEXT.
 * Distinct from incident intent (active emergencies) — but an active
 * incident ALSO wants hotlines, so callers typically OR the two.
 */

const HOTLINE_KEYWORDS = [
  "hotline",
  "hotlines",
  "emergency number",
  "emergency numbers",
  "rescue number",
  "contact number",
  "sino tatawagan",
  "sinong tatawagan",
  "anong number",
  "ano ang number",
  "pwede tawagan",
  "puedeng tawagan",
  "tumawag",
  "who do i call",
  "who should i call",
  "number ng rescue",
  "number ng barangay",
  // Post-disaster assistance: these callers need the DSWD/LGU desks, which
  // live in the same hotline directory.
  "relief goods",
  "relief good",
  "ayuda",
  "relief operation",
  "relief operations",
  "financial assistance",
  "tulong pinansyal",
  "saan kukuha ng tulong",
  "saan makakakuha",
  "nawawala",
  "nawawalang",
  "missing person",
  "hindi ko makontak",
];

const EVAC_KEYWORDS = [
  "evacuation center",
  "evacuation centers",
  "evacuation site",
  "evac center",
  "evac centers",
  "evacuation area",
  "where to evacuate",
  "where can we evacuate",
  "where should we evacuate",
  "saan lilikas",
  "saan kami lilikas",
  "saan pwede lumikas",
  "saan ang evacuation",
  "lilikas",
  "lumikas",
  "paglikas",
  "nearest shelter",
  "emergency shelter",
];

export type EmergencyInfoIntent = {
  hotlines: boolean;
  evac: boolean;
  match: boolean;
};

function normalize(message: string): string {
  return ` ${message.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, " ").replace(/\s+/g, " ")} `;
}

export function detectEmergencyInfoIntent(rawMessage: string): EmergencyInfoIntent {
  const message = normalize(rawMessage);
  const hotlines = HOTLINE_KEYWORDS.some((kw) => message.includes(kw));
  const evac = EVAC_KEYWORDS.some((kw) => message.includes(kw));
  return { hotlines, evac, match: hotlines || evac };
}

/** Short replies within this length can inherit emergency intent. */
const FOLLOW_UP_MAX_CHARS = 80;
/** How many prior user turns to scan. */
const FOLLOW_UP_LOOKBACK = 3;

/**
 * Like detectEmergencyInfoIntent, but lets a short follow-up ("opo", "yes",
 * "which one is nearest?") keep the emergency context of a recent turn.
 *
 * Without this the hotline and evac-center blocks vanished on turn 2: a user
 * who asked "saan kami lilikas?" and then replied "opo" lost the very data
 * they were answering about. Mirrors detectWeatherIntentWithHistory.
 *
 * `priorUserMessages` is oldest-first; only the most recent turns are scanned.
 */
export function detectEmergencyInfoIntentWithHistory(
  rawMessage: string,
  priorUserMessages: string[],
): EmergencyInfoIntent {
  const direct = detectEmergencyInfoIntent(rawMessage);
  if (direct.match) return direct;
  if (rawMessage.trim().length > FOLLOW_UP_MAX_CHARS) return direct;

  const recent = priorUserMessages.slice(-FOLLOW_UP_LOOKBACK);
  for (let i = recent.length - 1; i >= 0; i--) {
    const prior = detectEmergencyInfoIntent(recent[i]);
    if (prior.match) return prior;
  }

  return direct;
}
