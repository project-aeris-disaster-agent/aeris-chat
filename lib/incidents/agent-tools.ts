/**
 * Phase 5.3: tool definitions for the incident-drafting agent.
 *
 * These tools are offered to NVIDIA's OpenAI-compatible chat-completions
 * endpoint via the `tools` parameter. The model can call any of them; the
 * server executes the call and feeds the result back in a follow-up turn
 * (single-step here - we do not chain multi-step tool loops).
 *
 * Currently exposed:
 *  - lookup_typhoon_signal(area)
 *  - find_nearest_evacuation_center(lat, lng)
 *  - propose_incident_draft(...DraftIncidentReport fields...)
 *
 * propose_incident_draft is the only tool whose output is treated as the
 * agent's final answer; the other two are informational and feed back
 * into the model's next turn.
 */

import type { NvidiaToolDef } from "@/lib/nvidia-llm";
import { DRAFT_CATEGORIES } from "./intent";

export const LOOKUP_TYPHOON_SIGNAL_TOOL: NvidiaToolDef = {
  type: "function",
  function: {
    name: "lookup_typhoon_signal",
    description:
      "Look up the current PAGASA tropical cyclone wind signal for a Philippine area (province/city). Returns the active signal number (0-5) and a one-line summary.",
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

export const FIND_EVACUATION_CENTER_TOOL: NvidiaToolDef = {
  type: "function",
  function: {
    name: "find_nearest_evacuation_center",
    description:
      "Find the nearest known evacuation centers for a given latitude/longitude. Returns up to 3 nearest centers with name, address, distance in km.",
    parameters: {
      type: "object",
      properties: {
        lat: { type: "number", description: "Latitude in WGS84." },
        lng: { type: "number", description: "Longitude in WGS84." },
      },
      required: ["lat", "lng"],
      additionalProperties: false,
    },
  },
};

export const PROPOSE_INCIDENT_DRAFT_TOOL: NvidiaToolDef = {
  type: "function",
  function: {
    name: "propose_incident_draft",
    description:
      "Finalize the incident report draft once enough information is collected. Call this only when category, description, locationHint and peopleAffected are reasonably known (use null for fields the user did not provide).",
    parameters: {
      type: "object",
      properties: {
        category: { type: "string", enum: [...DRAFT_CATEGORIES] },
        description: { type: "string", maxLength: 400 },
        urgent: { type: "boolean" },
        suggestedSeverity: {
          type: "string",
          enum: ["low", "medium", "high", "critical"],
        },
        locationHint: { type: ["string", "null"] },
        peopleAffected: { type: ["integer", "null"], minimum: 0 },
        confidence: { type: "number", minimum: 0, maximum: 1 },
      },
      required: [
        "category",
        "description",
        "urgent",
        "suggestedSeverity",
        "confidence",
      ],
      additionalProperties: false,
    },
  },
};

export const INCIDENT_AGENT_TOOLS: NvidiaToolDef[] = [
  LOOKUP_TYPHOON_SIGNAL_TOOL,
  FIND_EVACUATION_CENTER_TOOL,
  PROPOSE_INCIDENT_DRAFT_TOOL,
];

/**
 * Static fallback evacuation-center directory. Real implementations would
 * query a Supabase table or municipal API; this list keeps the tool useful
 * during development and demos.
 */
const STATIC_EVAC_CENTERS: Array<{
  name: string;
  address: string;
  lat: number;
  lng: number;
}> = [
  {
    name: "Marikina Sports Center",
    address: "Sumulong Hwy, Marikina, Metro Manila",
    lat: 14.6433,
    lng: 121.1063,
  },
  {
    name: "Amoranto Sports Complex",
    address: "Don A. Roces Ave, Quezon City",
    lat: 14.6309,
    lng: 121.0179,
  },
  {
    name: "Pasig City Sports Center",
    address: "Caruncho Ave, Pasig",
    lat: 14.5749,
    lng: 121.0805,
  },
  {
    name: "Cebu City Sports Center",
    address: "Osmena Blvd, Cebu City",
    lat: 10.3127,
    lng: 123.8967,
  },
  {
    name: "Tacloban Convention Center",
    address: "Real St, Tacloban City",
    lat: 11.247,
    lng: 125.0036,
  },
];

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export async function runAgentTool(
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case "lookup_typhoon_signal": {
      const area = typeof args.area === "string" ? args.area : "";
      if (!area) return { error: "area is required" };
      const baseUrl = process.env.AERIS_DASHBOARD_API_BASE_URL?.replace(/\/$/, "");
      if (!baseUrl) {
        return {
          area,
          available: false,
          note: "Dashboard API not configured in this environment; cannot fetch live PAGASA signal.",
        };
      }
      try {
        const res = await fetch(
          `${baseUrl}/api/jtwc?area=${encodeURIComponent(area)}`,
          { cache: "no-store" },
        );
        if (!res.ok) {
          return { area, available: false, status: res.status };
        }
        const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        return { area, available: true, data };
      } catch (err) {
        return {
          area,
          available: false,
          error: (err as Error).message,
        };
      }
    }
    case "find_nearest_evacuation_center": {
      const lat = Number(args.lat);
      const lng = Number(args.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return { error: "lat and lng are required numbers" };
      }
      const ranked = STATIC_EVAC_CENTERS
        .map((center) => ({
          ...center,
          distanceKm: Number(haversineKm({ lat, lng }, center).toFixed(2)),
        }))
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, 3);
      return { from: { lat, lng }, centers: ranked };
    }
    case "propose_incident_draft": {
      // This is the agent's "final answer" - the caller handles routing.
      return { ...args, finalized: true };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
