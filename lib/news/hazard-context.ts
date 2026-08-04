/**
 * Bridges the existing news aggregator into the chat agent's grounding.
 *
 * AERIS has no PHIVOLCS feed, so earthquake, volcano, tsunami and landslide
 * questions previously reached the model with no source at all — and it
 * answered them from training data ("No eruption alert from PHIVOLCS as of my
 * last update"). The disaster news feed already tracks exactly those hazards
 * (lib/news/rss.ts DISASTER_KEYWORDS includes lindol, magnitude, bulkan,
 * eruption, tsunami, phivolcs), it was simply never wired to the agent.
 *
 * This is reporting, not an official bulletin — every item keeps its outlet and
 * timestamp so the model can attribute it, and the persona is instructed to
 * point at PHIVOLCS/PAGASA for authoritative status.
 */

import { aggregateNews } from "@/lib/news/aggregate";
import type { NewsItem } from "@/lib/news/rss";

/** Compact, model-facing shape. Deliberately omits images and ids. */
export type HazardNewsItem = {
  title: string;
  summary: string;
  source: string;
  publishedAt: string | null;
  /** Hours since publication, rounded — lets the model say "3 hours ago". */
  ageHours: number | null;
  link: string;
};

export type HazardNewsResult = {
  available: boolean;
  generatedAt: string;
  items: HazardNewsItem[];
  /** Advisory the model must relay: news is not an official bulletin. */
  advisory: string;
  error?: string;
};

const ADVISORY =
  "Philippine news reporting, not an official bulletin. Confirm earthquakes and volcanic activity with PHIVOLCS, and weather with PAGASA.";

/** Only recent reporting is useful for "is there X right now" questions. */
const MAX_AGE_HOURS = 72;
const MAX_ITEMS = 8;
const CACHE_TTL_MS = 5 * 60 * 1000;
const ERROR_TTL_MS = 60 * 1000;

let cache: { expiresAt: number; promise: Promise<HazardNewsResult> } | null = null;

function ageHours(publishedAt: string | null, now: number): number | null {
  if (!publishedAt) return null;
  const t = new Date(publishedAt).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.round((now - t) / 3_600_000));
}

function toHazardItem(item: NewsItem, now: number): HazardNewsItem {
  return {
    title: item.title,
    summary: item.summary,
    source: item.source,
    publishedAt: item.publishedAt,
    ageHours: ageHours(item.publishedAt, now),
    link: item.link,
  };
}

async function loadHazardNews(): Promise<HazardNewsResult> {
  const now = Date.now();
  const generatedAt = new Date(now).toISOString();

  let feed;
  try {
    feed = await aggregateNews();
  } catch (err) {
    return {
      available: false,
      generatedAt,
      items: [],
      advisory: ADVISORY,
      error: err instanceof Error ? err.message : "News fetch failed",
    };
  }

  // `error: true` means every upstream feed failed. Distinguish that from a
  // genuinely quiet news cycle — claiming "no reports" when we simply could
  // not fetch would be the negative-claim hallucination we are fixing.
  if (feed.error) {
    return {
      available: false,
      generatedAt,
      items: [],
      advisory: ADVISORY,
      error: feed.sourceErrors.slice(0, 3).join("; ") || "All news sources failed",
    };
  }

  const items = feed.items
    .filter((item) => item.isDisaster)
    .filter((item) => {
      const age = ageHours(item.publishedAt, now);
      // Keep undated items: a missing pubDate is a feed quirk, not staleness.
      return age === null || age <= MAX_AGE_HOURS;
    })
    .slice(0, MAX_ITEMS)
    .map((item) => toHazardItem(item, now));

  return { available: true, generatedAt, items, advisory: ADVISORY };
}

/**
 * Cached hazard-news fetch. The aggregator hits 10+ RSS feeds, so without this
 * every hazard question would re-fetch them all. Failures cache briefly so a
 * down upstream isn't stampeded.
 */
export function fetchHazardNews(): Promise<HazardNewsResult> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.promise;

  const promise = loadHazardNews().then((result) => {
    if (!result.available && cache?.promise === promise) {
      cache.expiresAt = Date.now() + ERROR_TTL_MS;
    }
    return result;
  });

  cache = { expiresAt: now + CACHE_TTL_MS, promise };
  return promise;
}

export function formatHazardNewsBlock(result: HazardNewsResult): string {
  return `HAZARD_NEWS (JSON):\n${JSON.stringify(result, null, 2)}`;
}

/** Test hook. */
export function clearHazardNewsCache(): void {
  cache = null;
}
