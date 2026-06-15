import { XMLParser } from "fast-xml-parser";
import type { NewsSource, NewsSourceCategory } from "./sources";

export type NewsItem = {
  id: string;
  title: string;
  link: string;
  summary: string;
  source: string;
  sourceCategory: NewsSourceCategory;
  publishedAt: string | null;
  imageUrl?: string;
  isDisaster: boolean;
};

const FETCH_TIMEOUT_MS = 9000;
const REVALIDATE_SECONDS = 600;
const MAX_ITEMS_PER_FEED = 25;
const SUMMARY_MAX_CHARS = 220;

// EN + FIL disaster relevance keywords (matched against title + summary).
const DISASTER_KEYWORDS = [
  "typhoon",
  "bagyo",
  "storm",
  "signal no",
  "storm signal",
  "flood",
  "baha",
  "earthquake",
  "lindol",
  "magnitude",
  "landslide",
  "eruption",
  "volcano",
  "bulkan",
  "tsunami",
  "habagat",
  "monsoon",
  "evacuat",
  "lpa",
  "low pressure area",
  "pagasa",
  "phivolcs",
  "ndrrmc",
  "rainfall warning",
  "red alert",
  "calamity",
  "sinkhole",
];

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  processEntities: true,
});

function textOf(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return textOf(value[0]);
  if (typeof value === "object") {
    const rec = value as Record<string, unknown>;
    if ("#text" in rec) return textOf(rec["#text"]);
    if ("__cdata" in rec) return textOf(rec.__cdata);
  }
  return "";
}

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeFromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => safeFromCodePoint(parseInt(dec, 10)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}

function safeFromCodePoint(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return "";
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

function stripHtml(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}\u2026`;
}

function extractImage(item: Record<string, unknown>, descriptionHtml: string): string | undefined {
  // media:content / media:thumbnail with url attribute (Inquirer, Rappler, etc.)
  for (const key of ["media:content", "media:thumbnail", "enclosure"]) {
    const node = item[key];
    const candidates = Array.isArray(node) ? node : [node];
    for (const c of candidates) {
      if (c && typeof c === "object") {
        const url = (c as Record<string, unknown>)["@_url"];
        if (typeof url === "string" && /^https?:\/\//.test(url)) return url;
      }
    }
  }
  // Inline <img> inside the description (GMA, Philstar)
  const match = descriptionHtml.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (match && /^https?:\/\//.test(match[1])) return match[1];
  return undefined;
}

function toIsoDate(raw: string): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function isDisasterText(text: string): boolean {
  const lower = text.toLowerCase();
  return DISASTER_KEYWORDS.some((kw) => lower.includes(kw));
}

function resolveLink(item: Record<string, unknown>): string {
  const link = item.link;
  if (typeof link === "string") return link;
  if (Array.isArray(link)) {
    for (const l of link) {
      if (typeof l === "string") return l;
      if (l && typeof l === "object") {
        const href = (l as Record<string, unknown>)["@_href"];
        if (typeof href === "string") return href;
      }
    }
  }
  if (link && typeof link === "object") {
    const href = (link as Record<string, unknown>)["@_href"];
    if (typeof href === "string") return href;
  }
  return "";
}

function normalizeItem(
  raw: Record<string, unknown>,
  source: NewsSource,
): NewsItem | null {
  let title = stripHtml(textOf(raw.title));
  if (!title) return null;

  const link = resolveLink(raw);
  if (!link) return null;

  const descriptionHtml = textOf(raw.description) || textOf(raw.summary) || textOf(raw.content);
  const summary = truncate(stripHtml(descriptionHtml), SUMMARY_MAX_CHARS);

  // Determine outlet name. Google News items carry the real outlet in <source>.
  let outlet = source.name;
  if (source.isGoogleNews) {
    const srcName = stripHtml(textOf(raw.source));
    if (srcName) {
      outlet = srcName;
      // Google News titles are formatted "Headline - Outlet"; trim the suffix.
      const suffix = ` - ${srcName}`;
      if (title.endsWith(suffix)) title = title.slice(0, -suffix.length).trim();
    }
  }

  const publishedAt = toIsoDate(
    textOf(raw.pubDate) || textOf(raw.published) || textOf(raw.updated) || textOf(raw["dc:date"]),
  );

  const guid = textOf(raw.guid) || link;
  const isDisaster =
    source.category === "disaster" || isDisasterText(`${title} ${summary}`);

  return {
    id: `${source.id}:${guid}`,
    title,
    link,
    summary,
    source: outlet,
    sourceCategory: source.category,
    publishedAt,
    imageUrl: extractImage(raw, descriptionHtml),
    isDisaster,
  };
}

export async function fetchFeed(source: NewsSource): Promise<NewsItem[]> {
  const response = await fetch(source.url, {
    headers: {
      Accept: "application/rss+xml, application/xml, text/xml, */*",
      "User-Agent": "Mozilla/5.0 (compatible; AERIS-Chat/1.0; +https://aeris)",
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    next: { revalidate: REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const xml = await response.text();
  const json = parser.parse(xml) as Record<string, unknown>;

  const rss = json.rss as Record<string, unknown> | undefined;
  const channel = (rss?.channel ?? json.feed) as Record<string, unknown> | undefined;
  if (!channel) return [];

  const rawItems = channel.item ?? channel.entry ?? [];
  const list = Array.isArray(rawItems) ? rawItems : [rawItems];

  const items: NewsItem[] = [];
  for (const raw of list.slice(0, MAX_ITEMS_PER_FEED)) {
    if (raw && typeof raw === "object") {
      const item = normalizeItem(raw as Record<string, unknown>, source);
      if (item) items.push(item);
    }
  }
  return items;
}
