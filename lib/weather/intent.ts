import { detectIncidentIntent } from "@/lib/incidents/intent";

const FORECAST_CONDITION_KEYWORDS = [
  "rain",
  "raining",
  "rainy",
  "rainfall",
  "flood",
  "flooding",
  "flooded",
  "magbabaha",
  "baha",
  "uulan",
  "ulan",
  "weather",
  "forecast",
  "precipitation",
  "shower",
  "showers",
  "stormy",
  "thunderstorm",
  "monsoon",
  "habagat",
  "amihan",
];

const FORECAST_TIME_KEYWORDS = [
  "tomorrow",
  "bukas",
  "this week",
  "next week",
  "ngayong linggo",
  "mamaya",
  "later today",
  "today",
  "ngayon",
];

const TYPHOON_KEYWORDS = [
  "typhoon",
  "bagyo",
  "bagyong",
  "cyclone",
  "tropical storm",
  "tropical depression",
  "tcws",
  "signal no",
  "signal number",
  "wind signal",
  "landfall",
  "par",
  "philippine area of responsibility",
  "storm surge",
  "super typhoon",
];

export type WeatherIntentKind = "forecast" | "typhoon" | "both";

export type WeatherIntentMatch = {
  match: boolean;
  kind: WeatherIntentKind | null;
  signals: string[];
};

function normalizeMessage(rawMessage: string): string {
  return ` ${rawMessage.toLowerCase().replace(/[^\p{L}\p{N}\s']/gu, " ").replace(/\s+/g, " ")} `;
}

function findKeyword(message: string, keywords: string[]): string | undefined {
  return keywords.find((kw) => message.includes(` ${kw} `) || message.includes(`${kw} `));
}

export function detectWeatherIntent(rawMessage: string): WeatherIntentMatch {
  const message = normalizeMessage(rawMessage);
  const signals: string[] = [];

  const incident = detectIncidentIntent(rawMessage);
  if (incident.match) {
    return { match: false, kind: null, signals: ["skipped:incident-intent"] };
  }

  const typhoonHit = findKeyword(message, TYPHOON_KEYWORDS);
  const conditionHit = findKeyword(message, FORECAST_CONDITION_KEYWORDS);
  const timeHit = findKeyword(message, FORECAST_TIME_KEYWORDS);
  const forecastHit = conditionHit || (timeHit && !typhoonHit);

  if (conditionHit) signals.push(`forecast:${conditionHit}`);
  if (timeHit) signals.push(`forecast-time:${timeHit}`);
  if (typhoonHit) signals.push(`typhoon:${typhoonHit}`);

  if (!forecastHit && !typhoonHit) {
    return { match: false, kind: null, signals };
  }

  let kind: WeatherIntentKind;
  if (forecastHit && typhoonHit) {
    kind = "both";
  } else if (typhoonHit) {
    kind = "typhoon";
  } else {
    kind = "forecast";
  }

  return { match: true, kind, signals };
}

/** Short replies within this length can inherit weather intent from history. */
const FOLLOW_UP_MAX_CHARS = 80;
/** How many prior user turns to scan for an inheritable weather intent. */
const FOLLOW_UP_LOOKBACK = 3;

/**
 * Like detectWeatherIntent, but lets a short follow-up ("and in Baguio?",
 * "what about Saturday?") inherit the weather intent of a recent user turn
 * that matched. Long messages never inherit — a topic change should not drag
 * stale weather context along.
 *
 * `priorUserMessages` must be ordered oldest-first (the natural transcript
 * order); only the most recent turns are scanned.
 */
export function detectWeatherIntentWithHistory(
  rawMessage: string,
  priorUserMessages: string[],
): WeatherIntentMatch {
  const direct = detectWeatherIntent(rawMessage);
  if (direct.match) return direct;

  // Direct signals like "skipped:incident-intent" must stand: an active
  // incident report is never a weather follow-up.
  if (direct.signals.includes("skipped:incident-intent")) return direct;

  if (rawMessage.trim().length > FOLLOW_UP_MAX_CHARS) return direct;

  const recent = priorUserMessages.slice(-FOLLOW_UP_LOOKBACK);
  for (let i = recent.length - 1; i >= 0; i--) {
    const prior = detectWeatherIntent(recent[i]);
    if (prior.match && prior.kind) {
      return {
        match: true,
        kind: prior.kind,
        signals: [...direct.signals, `follow-up:${prior.kind}`],
      };
    }
  }

  return direct;
}
