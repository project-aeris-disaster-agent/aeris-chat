import { fetchActiveCyclones, type ActiveCyclonesResult } from "@/lib/weather/gdacs";
import {
  fetchWeatherForecast,
  getWeatherPrefetchDays,
  type WeatherForecastResult,
} from "@/lib/weather/open-meteo";

/**
 * In-memory TTL cache for upstream weather fetches. Many users in the same
 * city ask the same question within minutes; forecasts don't change that
 * fast, and Open-Meteo/GDACS have no auth so hammering them risks IP-level
 * throttling. Per-instance only (serverless instances each keep their own),
 * which is fine: this is a load/latency optimization, not a correctness one.
 *
 * Failed fetches are cached briefly too, so a down upstream doesn't get
 * stampeded by every chat message while it recovers.
 */

const FORECAST_TTL_MS = 10 * 60 * 1000;
const CYCLONES_TTL_MS = 5 * 60 * 1000;
const ERROR_TTL_MS = 60 * 1000;
const MAX_ENTRIES = 500;

type CacheEntry<T> = {
  expiresAt: number;
  promise: Promise<T>;
};

const store = new Map<string, CacheEntry<unknown>>();

function getOrFetch<T>(
  key: string,
  ttlMs: number,
  errorTtlMs: number,
  fetcher: () => Promise<T>,
  succeeded: (value: T) => boolean,
): Promise<T> {
  const now = Date.now();
  const existing = store.get(key) as CacheEntry<T> | undefined;
  if (existing && existing.expiresAt > now) {
    return existing.promise;
  }

  // Sharing the in-flight promise also coalesces concurrent requests.
  const promise = fetcher().then((value) => {
    if (!succeeded(value)) {
      const entry = store.get(key) as CacheEntry<T> | undefined;
      if (entry && entry.promise === promise) {
        entry.expiresAt = Date.now() + errorTtlMs;
      }
    }
    return value;
  });

  if (store.size >= MAX_ENTRIES) {
    // Evict expired entries first; if none expired, drop the oldest inserted.
    for (const [k, entry] of store) {
      if (entry.expiresAt <= now) store.delete(k);
    }
    if (store.size >= MAX_ENTRIES) {
      const oldest = store.keys().next().value;
      if (oldest !== undefined) store.delete(oldest);
    }
  }

  store.set(key, { expiresAt: now + ttlMs, promise });
  return promise;
}

/** Cache key rounds coordinates to ~1km so nearby users share entries. */
function forecastKey(lat: number, lng: number, days: number): string {
  return `forecast:${lat.toFixed(2)}:${lng.toFixed(2)}:${days}`;
}

export function cachedFetchWeatherForecast(
  lat: number,
  lng: number,
  days = getWeatherPrefetchDays(),
): Promise<WeatherForecastResult> {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return fetchWeatherForecast(lat, lng, days);
  }
  return getOrFetch(
    forecastKey(lat, lng, days),
    FORECAST_TTL_MS,
    ERROR_TTL_MS,
    () => fetchWeatherForecast(lat, lng, days),
    (result) => result.available,
  );
}

export function cachedFetchActiveCyclones(): Promise<ActiveCyclonesResult> {
  return getOrFetch(
    "cyclones",
    CYCLONES_TTL_MS,
    ERROR_TTL_MS,
    () => fetchActiveCyclones(),
    (result) => result.available,
  );
}

/** Test hook: clear all cached entries. */
export function clearWeatherCache(): void {
  store.clear();
}
