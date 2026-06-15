export type NewsSourceCategory = "disaster" | "general";

export type NewsSource = {
  id: string;
  /** Display name used for direct outlet feeds. Google News feeds derive the
   *  real outlet name from each item's <source> tag, so this is only a fallback. */
  name: string;
  url: string;
  category: NewsSourceCategory;
  /** Google News aggregator feeds expose the originating outlet per-item. */
  isGoogleNews?: boolean;
};

const GOOGLE_NEWS_PH = "hl=en-PH&gl=PH&ceid=PH:en";

/**
 * Config-driven feed list. Adding/removing an outlet is a one-line change.
 *
 * Notes on availability (verified live):
 *  - GMA, Philstar, Inquirer, Rappler, Manila Times expose public RSS directly.
 *  - ABS-CBN and One News block direct RSS (403/404), so we pull their coverage
 *    through Google News (site: queries), which is keyless and reliable.
 *  - PAGASA / PHIVOLCS publish no RSS, so disaster advisories are surfaced via a
 *    Google News keyword search scoped to the Philippines.
 */
export const NEWS_SOURCES: NewsSource[] = [
  // --- Disaster-focused ---
  {
    id: "gnews-disaster",
    name: "Disaster Watch",
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(
      "Philippines (typhoon OR bagyo OR flood OR baha OR earthquake OR lindol OR landslide OR PAGASA OR PHIVOLCS OR NDRRMC OR \"storm signal\") when:3d",
    )}&${GOOGLE_NEWS_PH}`,
    category: "disaster",
    isGoogleNews: true,
  },

  // --- General national outlets (direct RSS) ---
  {
    id: "gma-top",
    name: "GMA News",
    url: "https://data.gmanetwork.com/gno/rss/news/feed.xml",
    category: "general",
  },
  {
    id: "gma-nation",
    name: "GMA News",
    url: "https://data.gmanetwork.com/gno/rss/news/nation/feed.xml",
    category: "general",
  },
  {
    id: "gma-regions",
    name: "GMA News",
    url: "https://data.gmanetwork.com/gno/rss/news/regions/feed.xml",
    category: "general",
  },
  {
    id: "philstar-headlines",
    name: "Philstar",
    url: "https://www.philstar.com/rss/headlines",
    category: "general",
  },
  {
    id: "philstar-nation",
    name: "Philstar",
    url: "https://www.philstar.com/rss/nation",
    category: "general",
  },
  {
    id: "inquirer-newsinfo",
    name: "Inquirer",
    url: "https://newsinfo.inquirer.net/feed",
    category: "general",
  },
  {
    id: "rappler",
    name: "Rappler",
    url: "https://www.rappler.com/feed/",
    category: "general",
  },
  {
    id: "manilatimes",
    name: "Manila Times",
    url: "https://www.manilatimes.net/news/feed/",
    category: "general",
  },

  // --- Outlets without usable direct RSS (via Google News) ---
  {
    id: "abscbn",
    name: "ABS-CBN News",
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(
      "when:2d site:abs-cbn.com",
    )}&${GOOGLE_NEWS_PH}`,
    category: "general",
    isGoogleNews: true,
  },
  {
    id: "onenews",
    name: "One News",
    url: `https://news.google.com/rss/search?q=${encodeURIComponent(
      "when:3d site:onenews.ph",
    )}&${GOOGLE_NEWS_PH}`,
    category: "general",
    isGoogleNews: true,
  },
];
