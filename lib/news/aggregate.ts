import { NEWS_SOURCES } from "./sources";
import { fetchFeed, type NewsItem } from "./rss";

const MAX_TOTAL_ITEMS = 100;

export type NewsFeedResult = {
  items: NewsItem[];
  fetchedAt: string;
  /** True when every source failed (UI shows a retry state). */
  error: boolean;
  sourceErrors: string[];
};

function normalizeTitleKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\u00f1]+/g, "")
    .trim();
}

function timeValue(item: NewsItem): number {
  return item.publishedAt ? new Date(item.publishedAt).getTime() : 0;
}

export async function aggregateNews(): Promise<NewsFeedResult> {
  const results = await Promise.allSettled(NEWS_SOURCES.map((s) => fetchFeed(s)));

  const collected: NewsItem[] = [];
  const sourceErrors: string[] = [];

  results.forEach((res, index) => {
    const source = NEWS_SOURCES[index];
    if (res.status === "fulfilled") {
      collected.push(...res.value);
    } else {
      const reason = res.reason instanceof Error ? res.reason.message : String(res.reason);
      sourceErrors.push(`${source.id}: ${reason}`);
    }
  });

  // Dedupe by normalized title (same story syndicated across outlets / sections).
  const seen = new Set<string>();
  const deduped = collected.filter((item) => {
    const key = normalizeTitleKey(item.title);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Disaster items first (by recency), then general headlines (by recency).
  deduped.sort((a, b) => {
    if (a.isDisaster !== b.isDisaster) return a.isDisaster ? -1 : 1;
    return timeValue(b) - timeValue(a);
  });

  return {
    items: deduped.slice(0, MAX_TOTAL_ITEMS),
    fetchedAt: new Date().toISOString(),
    error: deduped.length === 0 && sourceErrors.length > 0,
    sourceErrors,
  };
}
