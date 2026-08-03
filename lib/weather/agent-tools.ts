import type { NvidiaToolDef } from "@/lib/nvidia-llm";
import type { ChatLocationPayload } from "@/lib/chat/location-payload";
import { findNearbyEvacCenters } from "@/lib/emergency/evac-centers";
import { getHotlineDirectory } from "@/lib/emergency/hotlines";
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
      "Fetch active tropical cyclones from GDACS and assess proximity to the user's location and major Philippine cities. This is the right tool for general/national questions like 'is there a storm in PAR?' or 'any active typhoon?' — it needs no arguments and no place name. Call it once; a second call in the same turn returns the same cached data.",
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
      "Look up the current PAGASA tropical cyclone wind signal for ONE specific named Philippine province or city (e.g. 'is Marikina under signal no. 2?'). Requires AERIS Dashboard when configured. Do NOT call this for general/national questions ('is there a storm in PAR?', 'any typhoon right now?') — use get_active_typhoons for those instead. 'PAR' (Philippine Area of Responsibility) is not a valid area name here.",
    parameters: {
      type: "object",
      properties: {
        area: {
          type: "string",
          description: "A specific area name, e.g. 'Marikina' or 'Cebu province'. Never 'PAR' or 'Philippines'.",
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
      "Resolve a specific city/town/province name to latitude/longitude, so you can then call get_weather_forecast for that place. Only use this for a real, specific place the user named. 'PAR' (Philippine Area of Responsibility) is NOT a place to geocode — it refers to the whole country's cyclone-monitoring area; use get_active_typhoons instead.",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "A specific place name, e.g. 'Cebu City' or 'Bulacan'. Never 'PAR' or 'Philippines'.",
        },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
};

export const FIND_EVAC_CENTERS_TOOL: NvidiaToolDef = {
  type: "function",
  function: {
    name: "find_evac_centers",
    description:
      "Find community-mapped evacuation centers near coordinates (OpenStreetMap). Defaults to the user's location when lat/lng are omitted. Always relay the verify-with-barangay advisory.",
    parameters: {
      type: "object",
      properties: {
        lat: { type: "number", description: "Latitude (optional, defaults to user)." },
        lng: { type: "number", description: "Longitude (optional, defaults to user)." },
      },
      additionalProperties: false,
    },
  },
};

export const GET_EMERGENCY_HOTLINES_TOOL: NvidiaToolDef = {
  type: "function",
  function: {
    name: "get_emergency_hotlines",
    description:
      "Get the verified emergency hotline directory for the user's location (national + regional + city tiers). These are the only phone numbers you may state.",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
};

export const WEATHER_AGENT_TOOLS: NvidiaToolDef[] = [
  GET_WEATHER_FORECAST_TOOL,
  GET_ACTIVE_TYPHOONS_TOOL,
  LOOKUP_TYPHOON_SIGNAL_TOOL,
  GEOCODE_PLACE_TOOL,
  FIND_EVAC_CENTERS_TOOL,
  GET_EMERGENCY_HOTLINES_TOOL,
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
  // Lightweight visibility into which tools the model reaches for — the only
  // way to diagnose "why did it fail/take long" reports from production logs.
  console.log(`[weather-tool] ${name}`, args);
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
    case "find_evac_centers": {
      let lat = Number(args.lat);
      let lng = Number(args.lng);
      if ((!Number.isFinite(lat) || !Number.isFinite(lng)) && context.userLocation) {
        [lng, lat] = context.userLocation.position;
      }
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return { error: "No coordinates available; ask the user for their location." };
      }
      return findNearbyEvacCenters(lat, lng);
    }
    case "get_emergency_hotlines": {
      const loc = context.userLocation;
      if (!loc) return getHotlineDirectory();
      const [lng, lat] = loc.position;
      return getHotlineDirectory(lat, lng);
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
