import type { DetectedLocation } from "@/lib/location/detect-location";

export type ChatLocationPayload = {
  position: [number, number];
  label: string;
  source: "browser" | "ip";
  accuracyM?: number;
};

export function toChatLocationPayload(
  location: DetectedLocation | null,
): ChatLocationPayload | undefined {
  if (!location) return undefined;
  return {
    position: location.position,
    label: location.label,
    source: location.source,
    accuracyM: location.accuracyM,
  };
}

export function parseChatLocationPayload(raw: unknown): ChatLocationPayload | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as Record<string, unknown>;
  const position = record.position;
  if (!Array.isArray(position) || position.length < 2) return null;

  const lng = Number(position[0]);
  const lat = Number(position[1]);
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;

  const source = record.source;
  if (source !== "browser" && source !== "ip") return null;

  const label = typeof record.label === "string" ? record.label.trim() : "";
  const accuracyM = Number(record.accuracyM);

  return {
    position: [lng, lat],
    label: label || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    source,
    accuracyM: Number.isFinite(accuracyM) ? accuracyM : undefined,
  };
}

export function formatLocationContextBlock(
  location: ChatLocationPayload,
  now = new Date(),
): string {
  const [lng, lat] = location.position;
  const manilaTime = now.toLocaleString("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "full",
    timeStyle: "short",
  });

  return [
    "USER_LOCATION:",
    JSON.stringify({
      label: location.label,
      lat,
      lng,
      source: location.source,
      accuracyM: location.accuracyM ?? null,
    }),
    `CURRENT_TIME: ${now.toISOString()} (${manilaTime}, Asia/Manila)`,
  ].join("\n");
}

export async function resolveChatLocation(
  clientLocation: ChatLocationPayload | null,
  clientIp: string,
): Promise<ChatLocationPayload | null> {
  if (clientLocation) return clientLocation;

  const { resolveIpLocation } = await import("@/lib/location/server-ip-location");
  const ipLocation = await resolveIpLocation(clientIp);
  if (!ipLocation) return null;

  return {
    position: ipLocation.position,
    label: ipLocation.label,
    source: "ip",
    accuracyM: ipLocation.accuracyM,
  };
}
