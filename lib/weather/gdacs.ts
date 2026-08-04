// MAP rather than SEARCH: SEARCH ignores the eventtype filter server-side and
// truncates at 100 events (verified 2026-08-04), so an active PH storm can fall
// off the end. MAP honours `eventtypes` and returns the full current set.
const GDACS_EVENT_LIST_URL =
  "https://www.gdacs.org/gdacsapi/api/events/geteventlist/MAP?eventtypes=TC";
const FETCH_TIMEOUT_MS = 8000;
const FORECAST_WINDOW_DAYS = 7;

export type CycloneTrackPoint = {
  lat: number;
  lng: number;
  time?: string;
};

export type ActiveCyclone = {
  eventId: string;
  /** International name, e.g. "BAVI-26". */
  name: string;
  /**
   * PAGASA local name (e.g. "Ambo") when GDACS supplies `name_local`. Filipinos
   * hear this name on the radio, so it must lead whenever present. Often null:
   * GDACS only carries it for some PAR storms, and the authoritative source is
   * PAGASA's own bulletins (see docs/CAPABILITY_AUDIT_2026-08-04.md §4).
   */
  localName: string | null;
  alertLevel: string;
  severity?: string;
  fromDate?: string;
  toDate?: string;
  description?: string;
  trackPoints: CycloneTrackPoint[];
  inPhilippinesRegion: boolean;
  isCurrent: boolean;
};

export type ActiveCyclonesResult = {
  available: boolean;
  generatedAt: string;
  cyclones: ActiveCyclone[];
  error?: string;
};

function parseTrackPoints(raw: unknown): CycloneTrackPoint[] {
  if (!Array.isArray(raw)) return [];
  const points: CycloneTrackPoint[] = [];
  for (const point of raw) {
    if (!point || typeof point !== "object") continue;
    const record = point as Record<string, unknown>;
    const lat = Number(record.lat ?? record.latitude);
    const lng = Number(record.lon ?? record.lng ?? record.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    points.push({
      lat,
      lng,
      time: typeof record.time === "string" ? record.time : undefined,
    });
  }
  return points;
}

function isInPhilippinesRegion(points: CycloneTrackPoint[]): boolean {
  return points.some(
    (p) => p.lat >= 4 && p.lat <= 22 && p.lng >= 116 && p.lng <= 128,
  );
}

function affectsPhilippines(properties: Record<string, unknown>): boolean {
  const countries = properties.affectedcountries;
  if (!Array.isArray(countries)) return false;
  return countries.some((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const record = entry as Record<string, unknown>;
    const iso3 = String(record.iso3 ?? "").toUpperCase();
    const name = String(record.countryname ?? "").toLowerCase();
    return iso3 === "PHL" || name.includes("philippine");
  });
}

function isRelevantToForecastWindow(
  properties: Record<string, unknown>,
  now = new Date(),
): boolean {
  if (String(properties.iscurrent ?? "").toLowerCase() === "true") return true;

  const toDateRaw = properties.todate;
  if (typeof toDateRaw !== "string") return false;
  const toDate = new Date(toDateRaw);
  if (Number.isNaN(toDate.getTime())) return false;

  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() + FORECAST_WINDOW_DAYS);
  return toDate >= now && toDate <= windowEnd;
}

function parseGdacsFeature(feature: unknown): ActiveCyclone | null {
  if (!feature || typeof feature !== "object") return null;
  const record = feature as Record<string, unknown>;
  const properties = (record.properties ?? {}) as Record<string, unknown>;

  if (String(properties.eventtype ?? "").toUpperCase() !== "TC") return null;
  if (!isRelevantToForecastWindow(properties)) return null;

  const eventId = String(properties.eventid ?? properties.eventId ?? "");
  const name = String(properties.eventname ?? properties.name ?? "Unnamed").trim();
  if (!eventId && !name) return null;

  let trackPoints: CycloneTrackPoint[] = [];

  const geometry = record.geometry as Record<string, unknown> | undefined;
  if (geometry?.type === "Point" && Array.isArray(geometry.coordinates)) {
    const [lng, lat] = geometry.coordinates;
    if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
      trackPoints.push({ lat: Number(lat), lng: Number(lng) });
    }
  }

  trackPoints = [
    ...trackPoints,
    ...parseTrackPoints(properties.trackpoints ?? properties.track ?? properties.points),
  ];

  if (trackPoints.length === 0) {
    const lat = Number(properties.lat ?? properties.latitude);
    const lng = Number(properties.lon ?? properties.longitude);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      trackPoints.push({ lat, lng });
    }
  }

  const inPhilippinesRegion =
    isInPhilippinesRegion(trackPoints) || affectsPhilippines(properties);

  const localNameRaw = properties.name_local ?? properties.nameLocal;
  const localName =
    typeof localNameRaw === "string" && localNameRaw.trim() ? localNameRaw.trim() : null;

  return {
    eventId: eventId || name,
    name,
    localName,
    alertLevel: String(properties.alertlevel ?? properties.alertLevel ?? "unknown"),
    severity:
      typeof properties.severitydata === "object" && properties.severitydata
        ? String((properties.severitydata as Record<string, unknown>).severitytext ?? "")
        : undefined,
    fromDate: typeof properties.fromdate === "string" ? properties.fromdate : undefined,
    toDate: typeof properties.todate === "string" ? properties.todate : undefined,
    description: typeof properties.description === "string" ? properties.description : undefined,
    trackPoints,
    inPhilippinesRegion,
    isCurrent: String(properties.iscurrent ?? "").toLowerCase() === "true",
  };
}

/**
 * GDACS returns ONE FEATURE PER EPISODE, not per storm — a single cyclone can
 * appear 90+ times as it is re-forecast. Reporting those raw would tell the
 * user there are 176 active typhoons when there are 2 (verified 2026-08-04).
 *
 * Each episode also carries that moment's position, so merging a storm's
 * episodes reconstructs its track — which is what the proximity assessment
 * needs. Metadata is taken from the newest episode; points are unioned.
 */
export function mergeCycloneEpisodes(episodes: ActiveCyclone[]): ActiveCyclone[] {
  const byEvent = new Map<string, ActiveCyclone>();

  for (const episode of episodes) {
    const existing = byEvent.get(episode.eventId);
    if (!existing) {
      byEvent.set(episode.eventId, { ...episode, trackPoints: [...episode.trackPoints] });
      continue;
    }

    const seen = new Set(existing.trackPoints.map((p) => `${p.lat},${p.lng}`));
    for (const point of episode.trackPoints) {
      const key = `${point.lat},${point.lng}`;
      if (!seen.has(key)) {
        seen.add(key);
        existing.trackPoints.push(point);
      }
    }

    // Prefer the newer episode's metadata; `toDate` advances as it is re-issued.
    const isNewer = (episode.toDate ?? "") > (existing.toDate ?? "");
    if (isNewer) {
      existing.name = episode.name;
      existing.alertLevel = episode.alertLevel;
      existing.severity = episode.severity;
      existing.toDate = episode.toDate;
      existing.description = episode.description;
    }
    // Never lose a local name or a current flag to an older/blank episode.
    existing.localName = existing.localName ?? episode.localName;
    existing.isCurrent = existing.isCurrent || episode.isCurrent;
    existing.inPhilippinesRegion =
      existing.inPhilippinesRegion || episode.inPhilippinesRegion;
  }

  // Re-evaluate PH proximity against the fully merged track: a storm whose
  // individual episodes each looked non-PH may still cross the box overall.
  for (const cyclone of byEvent.values()) {
    cyclone.inPhilippinesRegion =
      cyclone.inPhilippinesRegion || isInPhilippinesRegion(cyclone.trackPoints);
  }

  return [...byEvent.values()];
}

export async function fetchActiveCyclones(): Promise<ActiveCyclonesResult> {
  const base: ActiveCyclonesResult = {
    available: false,
    generatedAt: new Date().toISOString(),
    cyclones: [],
  };

  try {
    const response = await fetch(GDACS_EVENT_LIST_URL, {
      cache: "no-store",
      headers: { Accept: "application/json", "User-Agent": "AERIS-Chat/1.0" },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      return { ...base, error: `GDACS HTTP ${response.status}` };
    }

    const data = (await response.json()) as {
      features?: unknown[];
      properties?: { eventlist?: unknown[] };
    };

    const features = Array.isArray(data.features)
      ? data.features
      : Array.isArray(data.properties?.eventlist)
        ? data.properties.eventlist
        : [];

    const cyclones = mergeCycloneEpisodes(
      features.map(parseGdacsFeature).filter((c): c is ActiveCyclone => c !== null),
    ).sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent));

    return {
      available: true,
      generatedAt: new Date().toISOString(),
      cyclones,
    };
  } catch (err) {
    return {
      ...base,
      error: err instanceof Error ? err.message : "GDACS fetch failed",
    };
  }
}
