import { PH_MAJOR_CITIES, type PhMajorCity } from "@/data/ph-major-cities";

export type PlaceMention = {
  name: string;
  region: string;
  lat: number;
  lng: number;
  matchedAlias: string;
};

/**
 * Common short forms that don't literally appear in PH_MAJOR_CITIES names.
 * Keys must be lowercase.
 */
const CITY_ALIASES: Record<string, string> = {
  cebu: "Cebu City",
  davao: "Davao City",
  qc: "Quezon City",
  gensan: "General Santos",
  cdo: "Cagayan de Oro",
  "iloilo": "Iloilo City",
  "batangas": "Batangas City",
  "surigao": "Surigao City",
  "zamboanga": "Zamboanga City",
};

type AliasEntry = { alias: string; city: PhMajorCity };

let aliasIndex: AliasEntry[] | null = null;

function buildAliasIndex(): AliasEntry[] {
  const byName = new Map(PH_MAJOR_CITIES.map((c) => [c.name.toLowerCase(), c]));
  const entries: AliasEntry[] = [];

  for (const city of PH_MAJOR_CITIES) {
    entries.push({ alias: city.name.toLowerCase(), city });
  }
  for (const [alias, cityName] of Object.entries(CITY_ALIASES)) {
    const city = byName.get(cityName.toLowerCase());
    if (city) entries.push({ alias, city });
  }

  // Longest alias first so "cebu city" wins over "cebu".
  return entries.sort((a, b) => b.alias.length - a.alias.length);
}

function normalize(message: string): string {
  return ` ${message.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, " ").replace(/\s+/g, " ")} `;
}

/**
 * Detect a Philippine city named in the message, using the offline
 * PH_MAJOR_CITIES list — no network call, safe to run on every message.
 * Returns the first (longest-alias) match, or null.
 */
export function detectPlaceMention(rawMessage: string): PlaceMention | null {
  const message = normalize(rawMessage);
  aliasIndex ??= buildAliasIndex();

  for (const { alias, city } of aliasIndex) {
    if (message.includes(` ${alias} `)) {
      return {
        name: city.name,
        region: city.region,
        lat: city.lat,
        lng: city.lng,
        matchedAlias: alias,
      };
    }
  }
  return null;
}

/** Same window as weather follow-up inheritance in lib/weather/intent.ts */
const FOLLOW_UP_MAX_CHARS = 80;
const FOLLOW_UP_LOOKBACK = 3;

/**
 * Like detectPlaceMention, but short follow-ups ("yes", "and tomorrow?")
 * inherit the place named in a recent user turn.
 */
export function detectPlaceMentionWithHistory(
  rawMessage: string,
  priorUserMessages: string[],
): PlaceMention | null {
  const direct = detectPlaceMention(rawMessage);
  if (direct) return direct;
  if (rawMessage.trim().length > FOLLOW_UP_MAX_CHARS) return null;

  const recent = priorUserMessages.slice(-FOLLOW_UP_LOOKBACK);
  for (let i = recent.length - 1; i >= 0; i--) {
    const prior = detectPlaceMention(recent[i]);
    if (prior) return prior;
  }
  return null;
}
