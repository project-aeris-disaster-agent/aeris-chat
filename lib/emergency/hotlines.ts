import { PH_MAJOR_CITIES } from "@/data/ph-major-cities";
import {
  emergencyHotlines,
  getHotlineRegionFilter,
  nagaQuickAccessHotlines,
  type EmergencyHotline,
  type HotlineRegionFilter,
  type QuickAccessHotline,
} from "@/data/emergency-hotlines";
import { haversineKm } from "@/lib/weather/haversine";

/**
 * Location-aware selection over the consolidated hotline directory in
 * data/emergency-hotlines.ts (single source of truth for the modal, the
 * /api/hotlines endpoint, AND the chat model's EMERGENCY_HOTLINES context).
 */

export type PhRegionCode =
  | "NCR" | "CAR" | "I" | "II" | "III" | "IV-A" | "IV-B" | "V" | "VI"
  | "VII" | "VIII" | "IX" | "X" | "XI" | "XII" | "XIII" | "NIR" | "BARMM";

/** Province/area (PH_MAJOR_CITIES `region` field) -> administrative region. */
const PROVINCE_TO_REGION: Record<string, PhRegionCode> = {
  NCR: "NCR",
  Rizal: "IV-A",
  Benguet: "CAR",
  Pampanga: "III",
  Zambales: "III",
  Batangas: "IV-A",
  Quezon: "IV-A",
  Albay: "V",
  "Camarines Sur": "V",
  "Camarines Norte": "V",
  Cagayan: "II",
  "Ilocos Norte": "I",
  "Ilocos Sur": "I",
  Pangasinan: "I",
  "La Union": "I",
  Palawan: "IV-B",
  Iloilo: "VI",
  "Negros Occidental": "NIR",
  Cebu: "VII",
  Leyte: "VIII",
  Samar: "VIII",
  "Eastern Samar": "VIII",
  "Negros Oriental": "NIR",
  Bohol: "VII",
  "Misamis Oriental": "X",
  "Agusan del Norte": "XIII",
  "Surigao del Norte": "XIII",
  "Davao del Sur": "XI",
  "South Cotabato": "XII",
  "Zamboanga del Sur": "IX",
  Maguindanao: "BARMM",
  "Lanao del Norte": "X",
  "Zamboanga del Norte": "IX",
};

/** Region code -> `area` labels used by data/emergency-hotlines.ts. */
const REGION_TO_AREAS: Record<PhRegionCode, string[]> = {
  NCR: ["NCR"],
  CAR: ["CAR"],
  I: ["R I"],
  II: ["R II"],
  III: ["R III"],
  "IV-A": ["R IV-A"],
  "IV-B": ["R IV-B"],
  V: ["R V"],
  VI: ["R VI"],
  VII: ["R VII"],
  VIII: ["R VIII"],
  IX: ["R IX"],
  X: ["R X"],
  XI: ["R XI"],
  XII: ["R XII"],
  XIII: ["R XIII", "CARAGA"],
  // NIR (re-established 2024) has no verified OCD line yet; legacy VI/VII
  // numbers would be a guess, so it intentionally maps to no regional area.
  NIR: [],
  BARMM: ["BARMM"],
};

const REGION_LABELS: Record<PhRegionCode, string> = {
  NCR: "Metro Manila (NCR)",
  CAR: "Cordillera (CAR)",
  I: "Ilocos (Region I)",
  II: "Cagayan Valley (Region II)",
  III: "Central Luzon (Region III)",
  "IV-A": "CALABARZON (Region IV-A)",
  "IV-B": "MIMAROPA (Region IV-B)",
  V: "Bicol (Region V)",
  VI: "Western Visayas (Region VI)",
  VII: "Central Visayas (Region VII)",
  VIII: "Eastern Visayas (Region VIII)",
  IX: "Zamboanga Peninsula (Region IX)",
  X: "Northern Mindanao (Region X)",
  XI: "Davao (Region XI)",
  XII: "SOCCSKSARGEN (Region XII)",
  XIII: "Caraga (Region XIII)",
  NIR: "Negros Island (NIR)",
  BARMM: "BARMM",
};

/** Disaster-relevant subset of the broad "NCR" area (which also holds
 * utilities and transport desks) used for the regional emergency tier. */
const NCR_REGIONAL_EMERGENCY_AGENCIES = new Set([
  "Metropolitan Manila Development Authority",
  "Office of Civil Defense - NCR",
  "Bureau of Fire Protection",
  "Philippine National Police",
  "Department of Social Welfare and Development",
]);

/** National agencies surfaced to the chat model and the API national tier. */
const NATIONAL_CONTEXT_AGENCIES = new Set([
  "Emergency 911 National Office",
  "National Disaster Risk Reduction Management Council",
  "Philippine Red Cross",
  "PAGASA",
  "Philippine Institute of Volcanology and Seismology",
  "Philippine Coast Guard",
]);

/** Beyond this distance from any known city we stop guessing the region. */
const MAX_REGION_RESOLVE_KM = 150;
/** Within this distance of a known city we surface its city hotlines. */
const CITY_MATCH_KM = 15;
/** Naga is the app's home city; give it a slightly wider catchment. */
const NAGA_MATCH_KM = 25;

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

  const cityMatchKm = best.name === "Naga" ? NAGA_MATCH_KM : CITY_MATCH_KM;
  return {
    region: PROVINCE_TO_REGION[best.province] ?? null,
    nearestCity: best.name,
    nearestCityKm: Number(best.km.toFixed(1)),
    cityForHotlines: best.km <= cityMatchKm ? best.name : null,
  };
}

/** City name (PH_MAJOR_CITIES) -> `area` labels in the dataset. */
function cityAreas(cityName: string): string[] {
  if (cityName === "Naga") return ["NAGA CITY"];
  if (cityName === "Manila") return ["NCR - Manila"];
  return [`NCR - ${cityName}`, cityName.toUpperCase()];
}

function primaryNumber(h: EmergencyHotline): string | null {
  return h.hotline ?? h.trunkDirectLine[0] ?? null;
}

export type HotlineDirectory = {
  resolved: ResolvedRegion;
  national: EmergencyHotline[];
  regional: EmergencyHotline[];
  city: EmergencyHotline[];
  advisory: string;
};

export function getHotlineDirectory(lat?: number, lng?: number): HotlineDirectory {
  const resolved =
    Number.isFinite(lat) && Number.isFinite(lng)
      ? resolveRegionForCoords(lat as number, lng as number)
      : { region: null, nearestCity: null, nearestCityKm: null, cityForHotlines: null };

  const national = emergencyHotlines.filter((h) =>
    NATIONAL_CONTEXT_AGENCIES.has(h.agency),
  );
  const regionAreas = resolved.region ? REGION_TO_AREAS[resolved.region] : [];
  const regional = emergencyHotlines
    .filter((h) => regionAreas.includes(h.area))
    .filter((h) => !NATIONAL_CONTEXT_AGENCIES.has(h.agency))
    // The "NCR" area also holds utilities/transport desks (MERALCO, tollways,
    // MRT...). Those belong in the modal's full list, not the emergency
    // tier the chat model and quick access draw from.
    .filter(
      (h) =>
        resolved.region !== "NCR" ||
        NCR_REGIONAL_EMERGENCY_AGENCIES.has(h.agency),
    );
  const areas = resolved.cityForHotlines ? cityAreas(resolved.cityForHotlines) : [];
  const city = emergencyHotlines.filter((h) => areas.includes(h.area));

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
  const line = (h: EmergencyHotline) => {
    const nums = [h.hotline, ...h.trunkDirectLine.slice(0, 2)]
      .filter((n): n is string => Boolean(n))
      .filter((n, i, a) => a.indexOf(n) === i);
    return `- ${h.agency}: ${nums.join(" / ")}`;
  };
  const parts: string[] = [
    "EMERGENCY_HOTLINES (verified directory; the ONLY phone numbers you may state):",
  ];
  if (directory.city.length > 0) parts.push("City:", ...directory.city.map(line));
  if (directory.regional.length > 0) parts.push("Regional:", ...directory.regional.map(line));
  parts.push("National:", ...directory.national.map(line));
  parts.push(`Advisory: ${directory.advisory}`);
  return parts.join("\n");
}

// ---------- Modal locale (which tab + quick-access set to show) ----------

export type HotlineLocale = {
  defaultFilter: HotlineRegionFilter;
  subtitle: string;
  quickLabel: string;
  quickAccess: QuickAccessHotline[];
};

function findByAgency(agency: string): EmergencyHotline | undefined {
  return emergencyHotlines.find((h) => h.agency === agency);
}

function quickTile(
  h: EmergencyHotline | undefined,
  shortLabel: string,
  icon: QuickAccessHotline["icon"],
): QuickAccessHotline | null {
  const number = h ? primaryNumber(h) : null;
  if (!h || !number) return null;
  return { label: h.agency, shortLabel, number, icon };
}

/**
 * Location-aware modal defaults. Near Naga the curated Naga quick-dial set
 * is preserved unchanged; elsewhere the tiles are composed from the same
 * verified directory (city rescue, regional OCD/MMDA, Red Cross, NDRRMC).
 */
export function getHotlineLocale(lat?: number, lng?: number): HotlineLocale {
  const directory = getHotlineDirectory(lat, lng);
  const { resolved } = directory;

  if (resolved.cityForHotlines === "Naga") {
    return {
      defaultFilter: "naga-city",
      subtitle: "Naga City & Bicol disaster hotlines",
      quickLabel: "Naga City",
      quickAccess: nagaQuickAccessHotlines,
    };
  }

  const tiles: (QuickAccessHotline | null)[] = [];

  const cityEntry = directory.city[0];
  if (cityEntry && resolved.cityForHotlines) {
    tiles.push(quickTile(cityEntry, resolved.cityForHotlines, "shield-alert"));
  }
  if (resolved.region === "NCR") {
    tiles.push(quickTile(findByAgency("Metropolitan Manila Development Authority"), "MMDA", "radio"));
  } else {
    const ocd = directory.regional.find((h) => h.agency.startsWith("Office of Civil Defense"));
    tiles.push(quickTile(ocd, "OCD Region", "radio"));
  }
  tiles.push(quickTile(findByAgency("Philippine Red Cross"), "Red Cross", "cross"));
  tiles.push(quickTile(findByAgency("National Disaster Risk Reduction Management Council"), "NDRRMC", "shield"));
  tiles.push(quickTile(findByAgency("PAGASA"), "PAGASA", "heart-pulse"));

  const quickAccess = tiles.filter((t): t is QuickAccessHotline => t !== null).slice(0, 6);

  const regionLabel = resolved.region ? REGION_LABELS[resolved.region] : null;
  const localeName = resolved.cityForHotlines ?? regionLabel;

  // Default tab follows the dataset's own region-filter taxonomy.
  let defaultFilter: HotlineRegionFilter = "naga-city";
  if (resolved.region) {
    const regionAreas = REGION_TO_AREAS[resolved.region];
    const probe = emergencyHotlines.find((h) => regionAreas.includes(h.area));
    if (resolved.region === "NCR") defaultFilter = "manila-hq";
    else if (probe) defaultFilter = getHotlineRegionFilter(probe);
  }

  return {
    defaultFilter,
    subtitle: localeName
      ? `${localeName} disaster hotlines`
      : "Philippine disaster hotlines",
    quickLabel: localeName ?? "Nationwide",
    quickAccess,
  };
}
