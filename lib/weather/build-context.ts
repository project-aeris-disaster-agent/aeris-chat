import type { ChatLocationPayload } from "@/lib/chat/location-payload";
import type { WeatherIntentKind } from "@/lib/weather/intent";
import { fetchActiveCyclones } from "@/lib/weather/gdacs";
import { fetchWeatherForecast, getWeatherPrefetchDays } from "@/lib/weather/open-meteo";
import { assessTyphoonImpact } from "@/lib/weather/proximity";

export type WeatherLiveContext = {
  generatedAt: string;
  regionLock: "Philippines";
  userLocation: {
    label: string;
    lat: number;
    lng: number;
    source: "browser" | "ip";
    accuracyM: number | null;
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
): Promise<WeatherLiveContext> {
  const [lng, lat] = location.position;
  const needsForecast = intentKind === "forecast" || intentKind === "both";
  const needsTyphoon = intentKind === "typhoon" || intentKind === "both";

  const [forecast, cyclones] = await Promise.all([
    needsForecast ? fetchWeatherForecast(lat, lng, days) : Promise.resolve(null),
    needsTyphoon ? fetchActiveCyclones() : Promise.resolve(null),
  ]);

  const typhoonImpact =
    needsTyphoon && cyclones?.available && cyclones.cyclones.length > 0
      ? assessTyphoonImpact(cyclones.cyclones, lat, lng)
      : needsTyphoon
        ? assessTyphoonImpact([], lat, lng)
        : null;

  return {
    generatedAt: new Date().toISOString(),
    regionLock: "Philippines",
    userLocation: {
      label: location.label,
      lat,
      lng,
      source: location.source,
      accuracyM: location.accuracyM ?? null,
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
