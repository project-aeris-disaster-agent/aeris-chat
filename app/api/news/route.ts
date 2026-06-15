import { NextResponse } from "next/server";
import { aggregateNews } from "@/lib/news/aggregate";

// Cache the aggregated response for 10 minutes at the edge/CDN; individual feed
// fetches inside aggregateNews use their own revalidate window.
export const revalidate = 600;

export async function GET() {
  const result = await aggregateNews();

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300",
    },
  });
}
