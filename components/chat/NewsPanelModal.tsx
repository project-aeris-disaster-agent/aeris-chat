"use client";

import React from "react";
import {
  X,
  Newspaper,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  Loader2,
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useNews } from "@/hooks/useNews";
import type { NewsItem } from "@/lib/news/rss";

interface NewsPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PAGE_SIZE = 15;

type CategoryFilter = "all" | "disaster" | "general";
type SortOrder = "newest" | "oldest";

const CATEGORY_OPTIONS: Array<{ value: CategoryFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "disaster", label: "Alerts" },
  { value: "general", label: "General" },
];

function timeValue(item: NewsItem): number {
  return item.publishedAt ? new Date(item.publishedAt).getTime() : 0;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  try {
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return "";
  }
}

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
    >
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt=""
          loading="lazy"
          className="h-16 w-16 shrink-0 rounded-md object-cover bg-muted"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : null}

      <div className="min-w-0 flex-1">
        <div className="mb-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
          {item.isDisaster && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 font-semibold text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              Alert
            </span>
          )}
          <span className="font-medium text-foreground/80">{item.source}</span>
          {item.publishedAt && (
            <>
              <span className="text-muted-foreground/50">·</span>
              <span className="text-muted-foreground">{relativeTime(item.publishedAt)}</span>
            </>
          )}
        </div>

        <h3 className="text-sm font-semibold leading-snug text-foreground line-clamp-2 group-hover:underline">
          {item.title}
        </h3>

        {item.summary && (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">
            {item.summary}
          </p>
        )}
      </div>

      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-foreground" />
    </a>
  );
}

function FeedSkeleton() {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3 rounded-lg border border-border p-3">
          <div className="h-16 w-16 shrink-0 animate-pulse rounded-md bg-muted" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-2.5 w-1/3 animate-pulse rounded bg-muted" />
            <div className="h-3.5 w-full animate-pulse rounded bg-muted" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function NewsPanelModal({ isOpen, onClose }: NewsPanelModalProps) {
  const { items, isLoading, isFetching, isError, refetch, fetchedAt } = useNews(isOpen);
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);
  const [category, setCategory] = React.useState<CategoryFilter>("disaster");
  const [source, setSource] = React.useState<string>("all");
  const [sortOrder, setSortOrder] = React.useState<SortOrder>("newest");

  // Reset to disaster-first defaults whenever the panel is reopened.
  React.useEffect(() => {
    if (isOpen) {
      setVisibleCount(PAGE_SIZE);
      setCategory("disaster");
      setSource("all");
      setSortOrder("newest");
    }
  }, [isOpen]);

  // Reset pagination whenever a filter/sort changes.
  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [category, source, sortOrder]);

  // Distinct outlet names for the source dropdown.
  const sourceOptions = React.useMemo(() => {
    return Array.from(new Set(items.map((i) => i.source))).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [items]);

  // Reset the source filter if the selected outlet is no longer present.
  React.useEffect(() => {
    if (source !== "all" && !sourceOptions.includes(source)) setSource("all");
  }, [source, sourceOptions]);

  const filtered = React.useMemo(() => {
    let result = items;
    if (category === "disaster") result = result.filter((i) => i.isDisaster);
    else if (category === "general") result = result.filter((i) => !i.isDisaster);
    if (source !== "all") result = result.filter((i) => i.source === source);

    const sorted = [...result].sort((a, b) =>
      sortOrder === "newest" ? timeValue(b) - timeValue(a) : timeValue(a) - timeValue(b),
    );
    return sorted;
  }, [items, category, source, sortOrder]);

  if (!isOpen) return null;

  const visible = filtered.slice(0, visibleCount);
  // Only split into sections in the unfiltered "All" view; otherwise show a flat list.
  const grouped = category === "all" && source === "all";
  const disasterItems = grouped ? visible.filter((i) => i.isDisaster) : [];
  const generalItems = grouped ? visible.filter((i) => !i.isDisaster) : visible;
  const hasMore = visibleCount < filtered.length;

  return (
    <>
      <div
        className="fixed inset-0 z-[10000] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="fixed inset-0 z-[10001] flex items-center justify-center p-2 md:p-4 pointer-events-none">
        <div
          className={cn(
            "bg-background border border-border rounded-lg shadow-xl",
            "w-full max-w-lg h-[90dvh] md:h-[85dvh]",
            "flex flex-col pointer-events-auto overflow-hidden",
            "animate-in fade-in-0 zoom-in-95 duration-200",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 md:px-6 md:py-4 flex-shrink-0">
            <div className="flex min-w-0 items-center gap-2">
              <Newspaper className="h-5 w-5 shrink-0 text-amber-500" />
              <div className="min-w-0">
                <h2 className="truncate text-base font-bold leading-tight text-foreground md:text-lg">
                  News
                </h2>
                <p className="truncate text-xs text-muted-foreground">
                  Disaster updates and national headlines
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                aria-label="Refresh news"
                title="Refresh"
              >
                <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close news panel"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Filters */}
          {!isLoading && !isError && items.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2 md:px-6 flex-shrink-0">
              <div className="flex items-center gap-1">
                {CATEGORY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCategory(opt.value)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                      category === opt.value
                        ? "bg-foreground text-background"
                        : "border border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="ml-auto flex items-center gap-1.5">
                <select
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  aria-label="Filter by source"
                  className="max-w-[8.5rem] truncate rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="all">All sources</option>
                  {sourceOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() =>
                    setSortOrder((o) => (o === "newest" ? "oldest" : "newest"))
                  }
                  className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
                  title={sortOrder === "newest" ? "Newest first" : "Oldest first"}
                  aria-label="Toggle sort order"
                >
                  {sortOrder === "newest" ? (
                    <ArrowDownWideNarrow className="h-3.5 w-3.5" />
                  ) : (
                    <ArrowUpWideNarrow className="h-3.5 w-3.5" />
                  )}
                  {sortOrder === "newest" ? "Newest" : "Oldest"}
                </button>
              </div>
            </div>
          )}

          {/* Feed */}
          <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 md:px-6">
            {isLoading ? (
              <FeedSkeleton />
            ) : isError ? (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                <AlertTriangle className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium text-foreground">
                  Couldn&apos;t load the news feed
                </p>
                <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
                  Check your connection and try again.
                </p>
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="mt-1 inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                <Newspaper className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium text-foreground">No news right now</p>
                <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
                  Pull to refresh in a few minutes.
                </p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
                <Newspaper className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium text-foreground">No matching stories</p>
                <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
                  Try a different filter or source.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {disasterItems.length > 0 && (
                  <section className="space-y-2.5">
                    <h4 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      Disaster updates
                    </h4>
                    {disasterItems.map((item) => (
                      <NewsCard key={item.id} item={item} />
                    ))}
                  </section>
                )}

                {generalItems.length > 0 && (
                  <section className="space-y-2.5">
                    {grouped && (
                      <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                        Latest news
                      </h4>
                    )}
                    {generalItems.map((item) => (
                      <NewsCard key={item.id} item={item} />
                    ))}
                  </section>
                )}

                {hasMore && (
                  <button
                    type="button"
                    onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border py-2.5 text-sm font-medium text-foreground hover:bg-muted"
                  >
                    Load more
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border px-4 py-2 md:px-6 flex-shrink-0">
            <p className="flex items-center gap-1.5 text-[11px] leading-snug text-muted-foreground">
              {isFetching && <Loader2 className="h-3 w-3 animate-spin" />}
              Aggregated from PAGASA coverage, GMA, ABS-CBN, One News, and other PH
              outlets. Always follow PAGASA, PHIVOLCS, and NDRRMC for official advisories.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
