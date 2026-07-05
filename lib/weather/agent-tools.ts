import type { NvidiaToolDef } from "@/lib/nvidia-llm";
import type { ChatLocationPayload } from "@/lib/chat/location-payload";
import { cachedFetchActiveCyclones, cachedFetchWeatherForecast } from "@/lib/weather/cache";
import { geocodePlace } from "@/lib/weather/geocode";
import { getWeatherPrefetchDays } from "@/lib/weather/open-meteo";
import { assessTyphoonImpact } from "@/lib/weather/proximity";

export const GET_WEATHER_FORECAST_TOOL: NvidiaToolDef = {
  type: "function",
  function: {
    name: "get_weather_forecast",
    description:
      "Fetch rain and precipitation forecast for a latitude/longitude from Open-Meteo. Use for follow-up questions about rain, flooding risk, or weather on specific days.",
    parameters: {
      type: "object",
      properties: {
        lat: { type: "number", description: "Latitude in WGS84." },
        lng: { type: "number", description: "Longitude in WGS84." },
        days: {
          type: "integer",
          minimum: 1,
          maximum: 7,
          description: "Number of forecast days (default 2).",
        },
      },
      required: ["lat", "lng"],
      additionalProperties: false,
    },
  },
};

export const GET_ACTIVE_TYPHOONS_TOOL: NvidiaToolDef = {
  type: "function",
  function: {
    name: "get_active_typhoons",
    description:
      "Fetch active tropical cyclones from GDACS and assess proximity to the user's location and major Philippine cities.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
};

export const LOOKUP_TYPHOON_SIGNAL_TOOL: NvidiaToolDef = {
  type: "function",
  function: {
    name: "lookup_typhoon_signal",
    description:
      "Look up the current PAGASA tropical cyclone wind signal for a Philippine area (province/city). Requires AERIS Dashboard when configured.",
    parameters: {
      type: "object",
      properties: {
        area: {
          type: "string",
          description: "Area name (e.g. 'Marikina', 'Cebu province').",
        },
      },
      required: ["area"],
      additionalProperties: false,
    },
  },
};

export const GEOCODE_PLACE_TOOL: NvidiaToolDef = {
  type: "function",
  function: {
    name: "geocode_place",
    description:
      "Resolve a place name (city, town, province) to latitude/longitude. Use when the user asks about weather in a named place and you don't have its coordinates; then call get_weather_forecast with the result.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Place name, e.g. 'Cebu City' or 'Bulacan'.",
        },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
};

export const WEATHER_AGENT_TOOLS: NvidiaToolDef[] = [
  GET_WEATHER_FORECAST_TOOL,
  GET_ACTIVE_TYPHOONS_TOOL,
  LOOKUP_TYPHOON_SIGNAL_TOOL,
  GEOCODE_PLACE_TOOL,
];

export type WeatherToolContext = {
  userLocation: ChatLocationPayload | null;
};

async function lookupTyphoonSignal(area: string): Promise<unknown> {
  if (!area) return { error: "area is required" };
  const baseUrl = process.env.AERIS_DASHBOARD_API_BASE_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    return {
      area,
      available: false,
      note: "Dashboard API not configured; cannot fetch live PAGASA signal.",
    };
  }
  try {
    const res = await fetch(`${baseUrl}/api/jtwc?area=${encodeURIComponent(area)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return { area, available: false, status: res.status };
    }
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { area, available: true, data };
  } catch (err) {
    return {
      area,
      available: false,
      error: err instanceof Error ? err.message : "lookup failed",
    };
  }
}

export async function runWeatherTool(
  name: string,
  args: Record<string, unknown>,
  context: WeatherToolContext,
): Promise<unknown> {
  switch (name) {
    case "get_weather_forecast": {
      const lat = Number(args.lat);
      const lng = Number(args.lng);
      const daysRaw = Number(args.days);
      const days =
        Number.isFinite(daysRaw) && daysRaw >= 1 && daysRaw <= 7
          ? daysRaw
          : getWeatherPrefetchDays();
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return { error: "lat and lng are required numbers" };
      }
      return cachedFetchWeatherForecast(lat, lng, days);
    }
    case "get_active_typhoons": {
      const cyclones = await cachedFetchActiveCyclones();
      if (!cyclones.available) return cyclones;
      const loc = context.userLocation;
      if (!loc) {
        return { ...cyclones, typhoonImpact: null, note: "User location unknown" };
      }
      const [lng, lat] = loc.position;
      return {
        ...cyclones,
        typhoonImpact: assessTyphoonImpact(cyclones.cyclones, lat, lng),
      };
    }
    case "lookup_typhoon_signal": {
      const area = typeof args.area === "string" ? args.area.trim() : "";
      return lookupTyphoonSignal(area);
    }
    case "geocode_place": {
      const name = typeof args.name === "string" ? args.name.trim() : "";
      if (!name) return { error: "name is required" };
      return geocodePlace(name);
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
