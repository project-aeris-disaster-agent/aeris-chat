export type DetectedLocation = {
  position: [number, number];
  accuracyM?: number;
  source: "browser" | "ip";
  label: string;
  metadata: Record<string, unknown>;
};

export const IP_LOCATION_CACHE_KEY = "aeris_ip_location_cache";

const IP_LOCATION_ACCURACY_M = 25000;
const IP_LOCATION_CACHE_TTL_MS = 5 * 60 * 1000;

type CachedIpLocation = DetectedLocation & { cachedAt: number };

export function formatCoordinatesLabel(position: [number, number]): string {
  const [longitude, latitude] = position;
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

function formatPlaceLabel(label: string): string {
  return label.replace(/, Philippines$/i, "").trim() || label;
}

function readIpLocationCache(): DetectedLocation | null {
  try {
    const raw = sessionStorage.getItem(IP_LOCATION_CACHE_KEY);
    if (!raw) return null;
    const cached: CachedIpLocation = JSON.parse(raw);
    if (Date.now() - cached.cachedAt > IP_LOCATION_CACHE_TTL_MS) {
      sessionStorage.removeItem(IP_LOCATION_CACHE_KEY);
      return null;
    }
    return cached;
  } catch {
    return null;
  }
}

function writeIpLocationCache(location: DetectedLocation): void {
  try {
    const entry: CachedIpLocation = { ...location, cachedAt: Date.now() };
    sessionStorage.setItem(IP_LOCATION_CACHE_KEY, JSON.stringify(entry));
  } catch {
    // sessionStorage unavailable
  }
}

export function clearIpLocationCache(): void {
  try {
    sessionStorage.removeItem(IP_LOCATION_CACHE_KEY);
  } catch {
    // sessionStorage unavailable
  }
}

export type BrowserLocationOptions = {
  /**
   * Stop early once a fix at or below this accuracy (in meters) arrives.
   * Mobile GPS typically converges to <30m; defaults to 35m.
   */
  desiredAccuracyM?: number;
  /** Maximum time to keep refining the fix before returning the best so far. */
  timeoutMs?: number;
};

const DEFAULT_DESIRED_ACCURACY_M = 35;
const DEFAULT_LOCATION_TIMEOUT_MS = 15000;

function toBrowserLocation(position: GeolocationPosition): DetectedLocation {
  const longitude = Number(position.coords.longitude.toFixed(6));
  const latitude = Number(position.coords.latitude.toFixed(6));
  const accuracyM = Math.round(position.coords.accuracy);
  return {
    position: [longitude, latitude],
    accuracyM,
    source: "browser",
    label: "Precise device location detected",
    metadata: {
      geolocation: {
        source: "browser",
        accuracyM,
        altitude: position.coords.altitude ?? undefined,
        heading: position.coords.heading ?? undefined,
        speed: position.coords.speed ?? undefined,
        capturedAt: new Date(position.timestamp).toISOString(),
      },
    },
  };
}

/**
 * Acquire the most accurate device fix available.
 *
 * On mobile the first geolocation callback is usually a coarse Wi-Fi/cell
 * estimate; the GPS radio then delivers progressively tighter fixes. We watch
 * the position and keep the best one, forcing a fresh reading (`maximumAge: 0`)
 * and high accuracy so Android and iOS both engage GPS rather than returning a
 * stale, low-accuracy cached location.
 */
export async function getBrowserLocation(
  options?: BrowserLocationOptions,
): Promise<DetectedLocation | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;

  const desiredAccuracyM = options?.desiredAccuracyM ?? DEFAULT_DESIRED_ACCURACY_M;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_LOCATION_TIMEOUT_MS;

  return new Promise((resolve) => {
    let best: GeolocationPosition | null = null;
    let settled = false;
    let watchId: number | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    };

    const finish = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(best ? toBrowserLocation(best) : null);
    };

    timer = setTimeout(finish, timeoutMs);

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (!best || position.coords.accuracy < best.coords.accuracy) {
          best = position;
        }
        // Good enough — no need to keep the GPS radio spinning.
        if (position.coords.accuracy <= desiredAccuracyM) {
          finish();
        }
      },
      () => {
        // Surface whatever best fix we collected before the error.
        finish();
      },
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}

export async function getGeolocationPermission(): Promise<PermissionState | "unsupported"> {
  if (!navigator.permissions?.query) return "unsupported";

  try {
    const result = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    return result.state;
  } catch {
    return "unsupported";
  }
}

export async function getIpLocation(): Promise<DetectedLocation | null> {
  const cached = readIpLocationCache();
  if (cached) return cached;

  try {
    const response = await fetch("/api/location", { cache: "no-store" });
    if (!response.ok) return null;
    const data = await response.json();
    const longitude = Number(data.position?.[0]);
    const latitude = Number(data.position?.[1]);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;

    const result: DetectedLocation = {
      position: [longitude, latitude],
      accuracyM: typeof data.accuracyM === "number" ? data.accuracyM : IP_LOCATION_ACCURACY_M,
      source: "ip",
      label:
        typeof data.label === "string" && data.label
          ? data.label
          : "Approximate IP location detected",
      metadata: typeof data.metadata === "object" && data.metadata ? data.metadata : {},
    };
    writeIpLocationCache(result);
    return result;
  } catch {
    return null;
  }
}

async function reverseGeocode(position: [number, number]): Promise<string | null> {
  const [longitude, latitude] = position;
  const params = new URLSearchParams({
    format: "jsonv2",
    lat: latitude.toString(),
    lon: longitude.toString(),
  });

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params.toString()}`, {
      cache: "no-store",
      headers: { "accept-language": "en" },
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return null;

    const data = await response.json();
    if (typeof data.display_name === "string" && data.display_name.trim().length > 0) {
      return data.display_name;
    }
    return null;
  } catch {
    return null;
  }
}

async function resolvePlaceLabel(
  location: DetectedLocation,
  ipFallbackLabel?: string,
): Promise<string> {
  if (location.source === "ip") {
    return formatPlaceLabel(location.label);
  }

  const reversed = await reverseGeocode(location.position);
  if (reversed) {
    const parts = reversed.split(",").map((part) => part.trim()).slice(0, 2);
    if (parts.length > 0) return parts.join(", ");
  }

  if (ipFallbackLabel) return formatPlaceLabel(ipFallbackLabel);
  return formatCoordinatesLabel(location.position);
}

export async function detectUserLocation(options?: {
  allowBrowserPrompt?: boolean;
  desiredAccuracyM?: number;
  timeoutMs?: number;
}): Promise<DetectedLocation | null> {
  const ipLocation = await getIpLocation();
  const permission = await getGeolocationPermission();
  const shouldUseBrowserLocation =
    permission === "granted" || (options?.allowBrowserPrompt && permission !== "denied");

  if (shouldUseBrowserLocation) {
    const browserLocation = await getBrowserLocation({
      desiredAccuracyM: options?.desiredAccuracyM,
      timeoutMs: options?.timeoutMs,
    });
    if (browserLocation) {
      return {
        ...browserLocation,
        metadata: {
          ...ipLocation?.metadata,
          ...browserLocation.metadata,
          geolocationPermission: permission,
        },
      };
    }
  }

  return ipLocation;
}

export function buildBannerMetadataLine(): string {
  return "Disaster Resilience AI Agent Application";
}

export async function buildLocationDisplayLine(
  location: DetectedLocation | null,
  ipFallbackLabel?: string,
): Promise<string> {
  if (!location) return "Location unavailable";

  const place = await resolvePlaceLabel(location, ipFallbackLabel);
  const coords = formatCoordinatesLabel(location.position);
  return `${place} · ${coords}`;
}
