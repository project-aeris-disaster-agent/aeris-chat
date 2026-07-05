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
