import { PH_MAJOR_CITIES } from "@/data/ph-major-cities";
import {
  PH_HOTLINES,
  PROVINCE_TO_REGION,
  type Hotline,
  type PhRegionCode,
} from "@/data/ph-hotlines";
import { haversineKm } from "@/lib/weather/haversine";

/** Beyond this distance from any known city we stop guessing the region. */
const MAX_REGION_RESOLVE_KM = 150;
/** Within this distance of a known city we also surface its city hotlines. */
const CITY_MATCH_KM = 15;

export type ResolvedRegion = {
  region: PhRegionCode | null;
  nearestCity: string | null;
  nearestCityKm: number | null;
  cityForHotlines: string | null;
};

export function resolveRegionForCoords(lat: number, lng: number): ResolvedRegion {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return { region: null, nearestCity: null, nearestCityKm: null, cityForHotlines: null };
  }

  let best: { name: string; province: string; km: number } | null = null;
  for (const city of PH_MAJOR_CITIES) {
    const km = haversineKm({ lat, lng }, { lat: city.lat, lng: city.lng });
    if (!best || km < best.km) best = { name: city.name, province: city.region, km };
  }

  if (!best || best.km > MAX_REGION_RESOLVE_KM) {
    return { region: null, nearestCity: null, nearestCityKm: null, cityForHotlines: null };
  }

  return {
    region: PROVINCE_TO_REGION[best.province] ?? null,
    nearestCity: best.name,
    nearestCityKm: Number(best.km.toFixed(1)),
    cityForHotlines: best.km <= CITY_MATCH_KM ? best.name : null,
  };
}

export type HotlineDirectory = {
  resolved: ResolvedRegion;
  national: Hotline[];
  regional: Hotline[];
  city: Hotline[];
  advisory: string;
};

/**
 * Location-aware hotline lookup. National numbers always apply; regional and
 * city tiers are added when coordinates resolve. This is the ONLY approved
 * source of phone numbers for the chat persona and the Quick Access UI.
 */
export function getHotlineDirectory(lat?: number, lng?: number): HotlineDirectory {
  const resolved =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? resolveRegionForCoords(lat as number, lng as number)
      : { region: null, nearestCity: null, nearestCityKm: null, cityForHotlines: null };

  const national = PH_HOTLINES.filter((h) => h.scope === "national");
  const regional = resolved.region
    ? PH_HOTLINES.filter((h) => h.scope === "regional" && h.region === resolved.region)
    : [];
  const city = resolved.cityForHotlines
    ? PH_HOTLINES.filter((h) => h.scope === "city" && h.city === resolved.cityForHotlines)
    : [];

  return {
    resolved,
    national,
    regional,
    city,
    advisory:
      resolved.region === null
        ? "Location not resolved to a Philippine region — showing national hotlines. Your barangay and city DRRMO also keep local numbers."
        : city.length === 0
          ? "No verified city hotline on file for your exact area — the regional and national lines below work everywhere. Your barangay and city DRRMO also keep local numbers."
          : "Call 911 first in any life-threatening emergency.",
  };
}

/** Compact system-context block for the chat model. */
export function formatHotlineContextBlock(directory: HotlineDirectory): string {
  const line = (h: Hotline) => `- ${h.org}: ${h.numbers.join(" / ")}`;
  const parts: string[] = [
    "EMERGENCY_HOTLINES (verified 2026-07; the ONLY phone numbers you may state):",
  ];
  if (directory.city.length > 0) {
    parts.push("City:", ...directory.city.map(line));
  }
  if (directory.regional.length > 0) {
    parts.push("Regional:", ...directory.regional.map(line));
  }
  parts.push("National:", ...directory.national.map(line));
  parts.push(`Advisory: ${directory.advisory}`);
  return parts.join("\n");
}
