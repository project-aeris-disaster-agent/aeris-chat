import { haversineKm } from "@/lib/weather/haversine";

/**
 * Live evacuation-center lookup via OpenStreetMap (Overpass API).
 *
 * We deliberately query OSM live instead of shipping a hardcoded list:
 * official LGU evacuation lists are activated per-event and go stale fast,
 * while the PH OSM community actively maps permanent centers (tagged
 * emergency=evacuation_centre or shelter_type=evacuation). Results always
 * carry attribution and a verify-with-your-barangay advisory — this is
 * guidance, not dispatch.
 */

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];
/**
 * Per-endpoint ceiling. Because the mirrors are RACED rather than tried in
 * series (see fetchFromOverpass), this is also the overall wall-clock ceiling
 * for the whole lookup — no separate total budget is needed.
 */
const FETCH_TIMEOUT_MS = 12_000;
const SEARCH_RADIUS_M = 10_000;
const MAX_RESULTS = 8;
const CACHE_TTL_MS = 10 * 60 * 1000;

export type EvacCenter = {
  name: string;
  lat: number;
  lng: number;
  distanceKm: number;
  osmId: string;
  addressHint: string | null;
};

export type EvacCentersResult = {
  available: boolean;
  centers: EvacCenter[];
  searchRadiusKm: number;
  attribution: string;
  advisory: string;
  error?: string;
};

const ATTRIBUTION = "OpenStreetMap community data (ODbL)";
const ADVISORY =
  "Community-mapped locations — before traveling, confirm the center is OPEN with your barangay or city DRRMO. During an active disaster, LGUs may open different sites.";

type CacheEntry = { expiresAt: number; promise: Promise<EvacCentersResult> };
const cache = new Map<string, CacheEntry>();

function buildQuery(lat: number, lng: number): string {
  const around = `around:${SEARCH_RADIUS_M},${lat},${lng}`;
  // Server timeout must stay under FETCH_TIMEOUT_MS so a slow server returns
  // a parseable timeout remark (which we treat as failure) instead of us
  // aborting mid-response. Short timeouts also cost less server quota.
  // The name clause MUST be anchored to an indexed key. A bare
  // `nwr[name~"..."]` has no index to start from, so Overpass full-scans the
  // radius: measured 2026-08-04 it timed out all three endpoints at 20s, which
  // is why evacuation lookups were failing in production. Anchoring to
  // `amenity` returns the same real centers in ~2.6s.
  //
  // Do NOT anchor to `building` instead — nearly every object carries it, so
  // that variant is just as unindexed and times out too (verified).
  return `[out:json][timeout:8];(
    nwr["emergency"~"^evacuation_cent(re|er)$"](${around});
    nwr["social_facility"="shelter"]["shelter_type"="evacuation"](${around});
    nwr["amenity"]["name"~"[Ee]vacuation [Cc]ent"](${around});
  );out center qt ${MAX_RESULTS * 4};`;
}

export type OverpassElement = {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

/** Exported for tests: filtering, dedup, and distance sorting. */
export function parseElements(elements: OverpassElement[], userLat: number, userLng: number): EvacCenter[] {
  const centers: EvacCenter[] = [];
  for (const el of elements) {
    const lat = el.lat ?? el.center?.lat;
    const lng = el.lon ?? el.center?.lon;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const name = el.tags?.name?.trim() ?? "";
    // Skip unnamed and low-confidence "Possible evacuation center" mappings —
    // we never send someone to a guess.
    if (!name || /possible/i.test(name)) continue;

    const street = el.tags?.["addr:street"];
    const barangay = el.tags?.["addr:suburb"] ?? el.tags?.["addr:village"];
    const cityTag = el.tags?.["addr:city"];
    const addressHint = [street, barangay, cityTag].filter(Boolean).join(", ") || null;

    centers.push({
      name,
      lat: lat as number,
      lng: lng as number,
      distanceKm: Number(
        haversineKm({ lat: userLat, lng: userLng }, { lat: lat as number, lng: lng as number }).toFixed(2),
      ),
      osmId: `${el.type}/${el.id}`,
      addressHint,
    });
  }

  centers.sort((a, b) => a.distanceKm - b.distanceKm);

  // Dedupe near-identical entries (same site mapped as node + building).
  const deduped: EvacCenter[] = [];
  for (const c of centers) {
    const dup = deduped.some(
      (d) =>
        d.name.toLowerCase() === c.name.toLowerCase() &&
        haversineKm({ lat: d.lat, lng: d.lng }, { lat: c.lat, lng: c.lng }) < 0.3,
    );
    if (!dup) deduped.push(c);
    if (deduped.length >= MAX_RESULTS) break;
  }
  return deduped;
}

async function fetchFromOverpass(lat: number, lng: number): Promise<EvacCentersResult> {
  const base: EvacCentersResult = {
    available: false,
    centers: [],
    searchRadiusKm: SEARCH_RADIUS_M / 1000,
    attribution: ATTRIBUTION,
    advisory: ADVISORY,
  };

  const query = buildQuery(lat, lng);

  /** One endpoint attempt. Rejects so Promise.any can pick the first success. */
  const attempt = async (endpoint: string): Promise<EvacCentersResult> => {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        // Overpass etiquette: identify the application.
        "user-agent": "AERIS-Chat/1.0 (disaster-response assistant; Philippines)",
      },
      body: `data=${encodeURIComponent(query)}`,
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);

    const data = (await res.json()) as { elements?: OverpassElement[]; remark?: string };
    // Overpass reports runtime errors (e.g. query timeouts) as HTTP 200 with a
    // "remark". An errored, empty response must read as "unavailable" — NEVER
    // as "there are no centers near you".
    const remarkError = typeof data.remark === "string" && /error/i.test(data.remark);
    const elements = data.elements ?? [];
    if (remarkError && elements.length === 0) {
      throw new Error(`Overpass remark: ${data.remark}`);
    }

    return { ...base, available: true, centers: parseElements(elements, lat, lng) };
  };

  // RACE the mirrors instead of trying them serially. Individual Overpass
  // endpoints swing between ~2.6s and >20s for the same query (measured
  // 2026-08-04), so a serial walk regularly burned the whole budget on one
  // slow mirror and returned "unavailable" while a sibling was answering fine.
  // Racing makes wall time the FASTEST mirror rather than the sum.
  //
  // This costs one extra request per cache miss, and results are cached for 10
  // minutes, so upstream load stays modest for a life-safety lookup.
  try {
    return await Promise.any(OVERPASS_ENDPOINTS.map(attempt));
  } catch (err) {
    // AggregateError when every mirror failed.
    const errors =
      err instanceof AggregateError
        ? err.errors.map((e) => (e instanceof Error ? e.message : String(e)))
        : [err instanceof Error ? err.message : "Overpass fetch failed"];
    return { ...base, error: [...new Set(errors)].join("; ") };
  }
}

export function findNearbyEvacCenters(lat: number, lng: number): Promise<EvacCentersResult> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return Promise.resolve({
      available: false,
      centers: [],
      searchRadiusKm: SEARCH_RADIUS_M / 1000,
      attribution: ATTRIBUTION,
      advisory: ADVISORY,
      error: "Invalid coordinates",
    });
  }

  const key = `${lat.toFixed(2)}:${lng.toFixed(2)}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > now) return hit.promise;

  const promise = fetchFromOverpass(lat, lng).then((result) => {
    if (!result.available) {
      const entry = cache.get(key);
      if (entry && entry.promise === promise) entry.expiresAt = Date.now() + 60_000;
    }
    return result;
  });
  if (cache.size > 300) cache.clear();
  cache.set(key, { expiresAt: now + CACHE_TTL_MS, promise });
  return promise;
}
