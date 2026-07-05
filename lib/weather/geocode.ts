const GEOCODE_BASE = "https://geocoding-api.open-meteo.com/v1/search";
const FETCH_TIMEOUT_MS = 6000;

export type GeocodedPlace = {
  name: string;
  admin1: string | null;
  countryCode: string;
  lat: number;
  lng: number;
};

export type GeocodeResult = {
  available: boolean;
  query: string;
  place: GeocodedPlace | null;
  error?: string;
};

/**
 * Resolve a free-text place name to coordinates via Open-Meteo's geocoding
 * API (same provider as the forecast, no key needed). Philippine matches are
 * preferred; a non-PH match is only returned if nothing in PH matched, so
 * "San Fernando" resolves locally instead of to Spain.
 */
export async function geocodePlace(query: string): Promise<GeocodeResult> {
  const trimmed = query.trim();
  const base: GeocodeResult = { available: false, query: trimmed, place: null };
  if (!trimmed) return { ...base, error: "Empty place name" };

  const params = new URLSearchParams({
    name: trimmed,
    count: "10",
    language: "en",
    format: "json",
  });

  try {
    const response = await fetch(`${GEOCODE_BASE}?${params}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      return { ...base, error: `Geocoding HTTP ${response.status}` };
    }

    const data = (await response.json()) as {
      results?: Array<{
        name?: string;
        admin1?: string;
        country_code?: string;
        latitude?: number;
        longitude?: number;
      }>;
    };

    const candidates = (data.results ?? []).filter(
      (r) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude),
    );
    if (candidates.length === 0) {
      return { ...base, available: true, error: "No match found" };
    }

    const best =
      candidates.find((r) => String(r.country_code ?? "").toUpperCase() === "PH") ??
      candidates[0];

    return {
      available: true,
      query: trimmed,
      place: {
        name: best.name ?? trimmed,
        admin1: best.admin1 ?? null,
        countryCode: String(best.country_code ?? "").toUpperCase(),
        lat: Number(best.latitude),
        lng: Number(best.longitude),
      },
    };
  } catch (err) {
    return {
      ...base,
      error: err instanceof Error ? err.message : "Geocoding fetch failed",
    };
  }
}
