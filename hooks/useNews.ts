"use client";

import { useQuery } from "@tanstack/react-query";
import type { NewsItem } from "@/lib/news/rss";

export type NewsFeedResponse = {
  items: NewsItem[];
  fetchedAt: string;
  error: boolean;
  sourceErrors: string[];
};

async function fetchNews(): Promise<NewsFeedResponse> {
  const response = await fetch("/api/news");
  if (!response.ok) {
    throw new Error(`Failed to load news (HTTP ${response.status})`);
  }
  return (await response.json()) as NewsFeedResponse;
}

/**
 * Fetches the aggregated news feed. Pass `enabled` (e.g. modal open state) so we
 * only hit the network when the feed is actually shown.
 */
export function useNews(enabled = true) {
  const query = useQuery({
    queryKey: ["news"],
    queryFn: fetchNews,
    enabled,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  return {
    items: query.data?.items ?? [],
    fetchedAt: query.data?.fetchedAt ?? null,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    isError: query.isError || (query.data?.error ?? false),
    refetch: query.refetch,
  };
}
