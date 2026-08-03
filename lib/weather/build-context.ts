import type { ChatLocationPayload } from "@/lib/chat/location-payload";
import type { WeatherIntentKind } from "@/lib/weather/intent";
import { cachedFetchActiveCyclones, cachedFetchWeatherForecast } from "@/lib/weather/cache";
import type { fetchActiveCyclones } from "@/lib/weather/gdacs";
import type { fetchWeatherForecast } from "@/lib/weather/open-meteo";
import { getWeatherPrefetchDays } from "@/lib/weather/open-meteo";
import { assessTyphoonImpact } from "@/lib/weather/proximity";

/** A place the user asked about that is not their own location. */
export type ForecastPlaceOverride = {
  label: string;
  lat: number;
  lng: number;
};

export type WeatherLiveContext = {
  generatedAt: string;
  regionLock: "Philippines";
  userLocation: {
    label: string;
    lat: number;
    lng: number;
    source: "browser" | "ip" | "default";
    accuracyM: number | null;
  };
  /**
   * False when userLocation is the synthetic PH-wide fallback (source
   * "default") rather than a real browser/IP fix. The model must not make
   * personal proximity/distance claims from a non-real location.
   */
  userLocationIsReal: boolean;
  /**
   * Where the forecast/typhoon-impact data below applies. Matches
   * userLocation unless the user asked about a different place by name.
   */
  forecastLocation: {
    label: string;
    lat: number;
    lng: number;
    isUserLocation: boolean;
  };
  intentKind: WeatherIntentKind;
  forecast: Awaited<ReturnType<typeof fetchWeatherForecast>> | null;
  cyclones: Awaited<ReturnType<typeof fetchActiveCyclones>> | null;
  typhoonImpact: ReturnType<typeof assessTyphoonImpact> | null;
};

export async function buildWeatherLiveContext(
  location: ChatLocationPayload,
  intentKind: WeatherIntentKind,
  days = getWeatherPrefetchDays(),
  placeOverride: ForecastPlaceOverride | null = null,
): Promise<WeatherLiveContext> {
  const [userLng, userLat] = location.position;
  const targetLat = placeOverride?.lat ?? userLat;
  const targetLng = placeOverride?.lng ?? userLng;

  const needsForecast = intentKind === "forecast" || intentKind === "both";
  const needsTyphoon = intentKind === "typhoon" || intentKind === "both";

  const [forecast, cyclones] = await Promise.all([
    needsForecast ? cachedFetchWeatherForecast(targetLat, targetLng, days) : Promise.resolve(null),
    needsTyphoon ? cachedFetchActiveCyclones() : Promise.resolve(null),
  ]);

  const typhoonImpact =
    needsTyphoon && cyclones?.available && cyclones.cyclones.length > 0
      ? assessTyphoonImpact(cyclones.cyclones, targetLat, targetLng)
      : needsTyphoon
        ? assessTyphoonImpact([], targetLat, targetLng)
        : null;

  return {
    generatedAt: new Date().toISOString(),
    regionLock: "Philippines",
    userLocation: {
      label: location.label,
      lat: userLat,
      lng: userLng,
      source: location.source,
      accuracyM: location.accuracyM ?? null,
    },
    userLocationIsReal: location.source !== "default",
    forecastLocation: {
      label: placeOverride?.label ?? location.label,
      lat: targetLat,
      lng: targetLng,
      isUserLocation: !placeOverride,
    },
    intentKind,
    forecast,
    cyclones,
    typhoonImpact,
  };
}

export function formatWeatherLiveContextBlock(context: WeatherLiveContext): string {
  return `LIVE_CONTEXT (JSON):\n${JSON.stringify(context, null, 2)}`;
}
