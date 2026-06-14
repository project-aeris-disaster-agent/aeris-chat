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

export async function getBrowserLocation(): Promise<DetectedLocation | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return null;

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const longitude = Number(position.coords.longitude.toFixed(6));
        const latitude = Number(position.coords.latitude.toFixed(6));
        resolve({
          position: [longitude, latitude],
          accuracyM: Math.round(position.coords.accuracy),
          source: "browser",
          label: "Precise device location detected",
          metadata: {
            geolocation: {
              source: "browser",
              accuracyM: Math.round(position.coords.accuracy),
            },
          },
        });
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
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
}): Promise<DetectedLocation | null> {
  const ipLocation = await getIpLocation();
  const permission = await getGeolocationPermission();
  const shouldUseBrowserLocation =
    permission === "granted" || (options?.allowBrowserPrompt && permission !== "denied");

  if (shouldUseBrowserLocation) {
    const browserLocation = await getBrowserLocation();
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
  return "Philippines · Live · Disaster Resilience · Application";
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
