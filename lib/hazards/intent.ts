/**
 * Detects hazard questions that the weather pipeline does NOT cover:
 * earthquakes, volcanoes, tsunamis, landslides, and general "what's happening"
 * situation queries.
 *
 * These previously matched no detector at all, so they reached the model with
 * zero grounding and it answered from training data. Matching them routes the
 * disaster news feed into context instead (lib/news/hazard-context.ts).
 */

export type HazardKind = "seismic" | "volcanic" | "landslide" | "general";

export type HazardIntentMatch = {
  match: boolean;
  kinds: HazardKind[];
  signals: string[];
};

const SEISMIC_KEYWORDS = [
  "earthquake",
  "earthquakes",
  "lindol",
  "aftershock",
  "aftershocks",
  "magnitude",
  "seismic",
  "tremor",
  "tremors",
  "yanig",
  "tsunami",
  "fault line",
  "faultline",
  "phivolcs",
];

const VOLCANIC_KEYWORDS = [
  "volcano",
  "volcanic",
  "bulkan",
  "eruption",
  "erupting",
  "erupt",
  "alert level",
  "ashfall",
  "ash fall",
  "abo ng bulkan",
  "lahar",
  "taal",
  "mayon",
  "kanlaon",
  "pinatubo",
  "bulusan",
];

const LANDSLIDE_KEYWORDS = [
  "landslide",
  "landslides",
  "guho ng lupa",
  "pagguho",
  "rockslide",
  "mudslide",
  "sinkhole",
];

/**
 * "What's happening / any advisory" style questions. Deliberately narrow —
 * these fire only as whole phrases so ordinary chat doesn't trip them.
 */
const GENERAL_NEWS_PATTERNS = [
  /\blatest (?:news|update|updates|advisor(?:y|ies)|bulletin)\b/i,
  /\bany (?:news|update|updates|advisor(?:y|ies)|alert|alerts|warning|warnings)\b/i,
  /\bwhat(?:'s| is) (?:happening|going on)\b/i,
  /\banong (?:balita|nangyayari)\b/i,
  /\bmay (?:balita|advisory|warning)\b/i,
  /\bnews (?:about|on)\b/i,
  /\bsituation report\b/i,
];

function normalize(raw: string): string {
  return ` ${raw.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, " ").replace(/\s+/g, " ")} `;
}

function hits(message: string, keywords: string[]): string | undefined {
  return keywords.find((kw) => message.includes(` ${kw} `) || message.includes(` ${kw}`));
}

export function detectHazardIntent(rawMessage: string): HazardIntentMatch {
  const message = normalize(rawMessage);
  const kinds: HazardKind[] = [];
  const signals: string[] = [];

  const seismic = hits(message, SEISMIC_KEYWORDS);
  if (seismic) {
    kinds.push("seismic");
    signals.push(`seismic:${seismic}`);
  }

  const volcanic = hits(message, VOLCANIC_KEYWORDS);
  if (volcanic) {
    kinds.push("volcanic");
    signals.push(`volcanic:${volcanic}`);
  }

  const landslide = hits(message, LANDSLIDE_KEYWORDS);
  if (landslide) {
    kinds.push("landslide");
    signals.push(`landslide:${landslide}`);
  }

  const general = GENERAL_NEWS_PATTERNS.find((re) => re.test(rawMessage));
  if (general) {
    kinds.push("general");
    signals.push("general:news-query");
  }

  return { match: kinds.length > 0, kinds, signals };
}
