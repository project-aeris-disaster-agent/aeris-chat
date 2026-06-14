"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AlertTriangle, CheckCircle2, Loader2, LocateFixed, Phone, Siren, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAnonymousSessionId } from "@/lib/utils/anonymous-session";
import {
  clearIpLocationCache,
  detectUserLocation,
  formatCoordinatesLabel,
  type DetectedLocation,
} from "@/lib/location/detect-location";
import { mapInteractionGuard } from "./location-map-guard";

const LocationMapPicker = dynamic(
  async () => (await import("./LocationMapPicker")).LocationMapPicker,
  { ssr: false },
);

const DEFAULT_MAP_CENTER: [number, number] = [121.027802, 14.566146];

type SOSConfirmModalProps = {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
  /** Called once the SOS report has been dispatched to the dashboard. */
  onDispatched?: (reportId: string) => void;
};

type SosLocation = {
  position: [number, number];
  accuracyM?: number;
  source: "browser" | "ip" | "manual";
  label: string;
  metadata: Record<string, unknown>;
};

type DispatchState = {
  status: "idle" | "dispatching" | "sent" | "error";
  message?: string;
  reportId?: string;
  messageId?: string;
};

async function reverseGeocode(position: [number, number]): Promise<string | null> {
  const [longitude, latitude] = position;
  const params = new URLSearchParams({
    format: "jsonv2",
    lat: latitude.toString(),
    lon: longitude.toString(),
  });

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
      {
        cache: "no-store",
        headers: { "accept-language": "en" },
        signal: AbortSignal.timeout(6000),
      },
    );
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

export function SOSConfirmModal({
  isOpen,
  onClose,
  sessionId,
  onDispatched,
}: SOSConfirmModalProps) {
  const [location, setLocation] = useState<SosLocation | null>(null);
  const [locating, setLocating] = useState(false);
  const [reverseGeocoding, setReverseGeocoding] = useState(false);
  const [dispatch, setDispatch] = useState<DispatchState>({ status: "idle" });
  const detectedOnceRef = useRef(false);

  const applyDetected = useCallback((detected: DetectedLocation) => {
    setLocation((current) => {
      // Don't clobber a manually pinned location.
      if (current?.source === "manual" || mapInteractionGuard.active) return current;
      return {
        position: detected.position,
        accuracyM: detected.accuracyM,
        source: detected.source,
        label: detected.label,
        metadata: detected.metadata,
      };
    });
  }, []);

  const detect = useCallback(
    async ({ allowBrowserPrompt = false }: { allowBrowserPrompt?: boolean } = {}) => {
      setLocating(true);
      try {
        const detected = await detectUserLocation({ allowBrowserPrompt });
        if (detected) {
          applyDetected(detected);

          // Resolve a human-readable address for precise (browser) locations.
          if (detected.source === "browser") {
            setReverseGeocoding(true);
            try {
              const label = await reverseGeocode(detected.position);
              if (label) {
                setLocation((current) => {
                  if (!current || current.source === "manual") return current;
                  const [lng, lat] = current.position;
                  if (lng !== detected.position[0] || lat !== detected.position[1]) {
                    return current;
                  }
                  return { ...current, label };
                });
              }
            } finally {
              setReverseGeocoding(false);
            }
          }
        }
      } finally {
        setLocating(false);
      }
    },
    [applyDetected],
  );

  // Auto-detect as soon as the SOS confirmation opens, prompting for precise
  // device location since this is a life-safety dispatch.
  useEffect(() => {
    if (!isOpen) {
      detectedOnceRef.current = false;
      setLocation(null);
      setDispatch({ status: "idle" });
      return;
    }
    if (detectedOnceRef.current) return;
    detectedOnceRef.current = true;
    void detect({ allowBrowserPrompt: true });
  }, [isOpen, detect]);

  const redetect = useCallback(async () => {
    clearIpLocationCache();
    setLocation(null);
    await detect({ allowBrowserPrompt: true });
  }, [detect]);

  const pinFromMap = useCallback(async (position: [number, number]) => {
    const coordinateLabel = formatCoordinatesLabel(position);
    setLocation((current) => ({
      position,
      accuracyM: undefined,
      source: "manual",
      label: `Pinned at ${coordinateLabel}`,
      metadata: {
        ...(current?.metadata ?? {}),
        locationSource: "manual",
        mapPin: {
          latitude: position[1],
          longitude: position[0],
          pinnedAt: new Date().toISOString(),
        },
      },
    }));

    setReverseGeocoding(true);
    try {
      const label = await reverseGeocode(position);
      if (!label) return;
      setLocation((current) => {
        if (!current) return current;
        const [lng, lat] = current.position;
        if (lng !== position[0] || lat !== position[1]) return current;
        return {
          ...current,
          label,
          metadata: { ...current.metadata, reverseGeocodedAddress: label },
        };
      });
    } finally {
      setReverseGeocoding(false);
    }
  }, []);

  const dispatchSOS = useCallback(async () => {
    if (!location) {
      setDispatch({
        status: "error",
        message: "We couldn't determine your location yet. Adjust the pin and try again.",
      });
      return;
    }

    setDispatch({ status: "dispatching" });
    try {
      const description = `AUTONOMOUS SOS — life-threatening emergency. Distress signal activated from AERIS chat. Immediate assistance requested at ${location.label}.`;

      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category: "SOS",
          description,
          position: location.position,
          locationAccuracyM: location.accuracyM,
          anonymousId: getAnonymousSessionId(),
          sessionId: sessionId ?? undefined,
          metadata: {
            ...location.metadata,
            sos: true,
            autonomous: true,
            source: "sos_button",
            sosTriggeredAt: new Date().toISOString(),
            detectedLocationLabel: location.label,
            locationSource: location.source,
          },
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error ?? `SOS dispatch failed (${response.status})`);
      }

      const reportId: string | undefined = body.report?.id;
      const messageId: string | undefined = body.report?.messageId;
      setDispatch({
        status: "sent",
        reportId,
        messageId,
      });
      if (reportId) onDispatched?.(reportId);
    } catch (error) {
      setDispatch({ status: "error", message: (error as Error).message });
    }
  }, [location, sessionId, onDispatched]);

  if (!isOpen) return null;

  const sent = dispatch.status === "sent";

  return (
    <>
      <div className="fixed inset-0 z-[10002] bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[10003] flex items-center justify-center p-4 pointer-events-none">
        <div
          className="pointer-events-auto flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-red-500/50 bg-background shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start gap-3 border-b border-border bg-red-500/10 px-5 py-4">
            {sent ? (
              <CheckCircle2 className="mt-0.5 h-6 w-6 flex-shrink-0 text-green-600 dark:text-green-400" />
            ) : (
              <AlertTriangle className="mt-0.5 h-6 w-6 flex-shrink-0 animate-pulse text-red-600 dark:text-red-400" />
            )}
            <div className="flex-1">
              <h2 className="text-base font-bold leading-tight text-foreground">
                {sent ? "SOS dispatched to responders" : "Confirm your SOS"}
              </h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {sent
                  ? "Your distress signal is now live on the AERIS dashboard."
                  : "AERIS will send your live location as an emergency report."}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Close SOS dialog"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {sent ? (
            <div className="space-y-4 px-5 py-4">
              <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-sm">
                <p className="font-semibold text-foreground">Report ID</p>
                <p className="mt-0.5 break-all text-xs text-muted-foreground">
                  {dispatch.messageId ?? dispatch.reportId}
                </p>
                {location && (
                  <p className="mt-2 text-xs text-muted-foreground">{location.label}</p>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Keep the alarm running so responders can find you. For immediate
                voice contact, call 911 now.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row-reverse">
                <Button
                  type="button"
                  className="flex-1 gap-2 bg-red-600 text-white hover:bg-red-700"
                  onClick={() => {
                    window.location.href = "tel:911";
                  }}
                >
                  <Phone className="h-4 w-4" />
                  Call 911
                </Button>
                <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 px-5 py-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Your location</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void redetect()}
                  disabled={locating}
                  className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
                >
                  {locating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <LocateFixed className="h-3.5 w-3.5" />
                  )}
                  {locating ? "Detecting..." : "Re-detect"}
                </Button>
              </div>

              <div className="space-y-2 rounded-md border border-border bg-muted/20 p-2">
                <LocationMapPicker
                  center={location?.position ?? DEFAULT_MAP_CENTER}
                  selected={location?.position}
                  onSelect={(position) => void pinFromMap(position)}
                />
                <p className="text-xs text-muted-foreground">
                  Drag the map so the pin sits exactly where help is needed.
                </p>
              </div>

              <div
                className={cn(
                  "rounded-md border-2 border-red-500/40 bg-red-500/[0.06] px-2 py-[6px] text-[11px] leading-tight text-muted-foreground",
                  "dark:border-red-500/50 dark:bg-red-500/15",
                )}
              >
                {locating
                  ? "Detecting your location..."
                  : reverseGeocoding
                    ? "Resolving address..."
                    : location
                      ? `${location.label}${
                          location.accuracyM
                            ? `, accuracy about ${location.accuracyM}m`
                            : ""
                        }`
                      : "Drag the map to set your exact location."}
              </div>

              {dispatch.status === "error" && (
                <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                  {dispatch.message}
                </p>
              )}

              <Button
                type="button"
                className="w-full gap-2 bg-red-600 py-6 text-base font-bold text-white hover:bg-red-700"
                onClick={() => void dispatchSOS()}
                disabled={dispatch.status === "dispatching" || (!location && locating)}
              >
                {dispatch.status === "dispatching" ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Dispatching SOS...
                  </>
                ) : (
                  <>
                    <Siren className="h-5 w-5" />
                    Send SOS to responders
                  </>
                )}
              </Button>
              <p className="text-center text-[11px] text-muted-foreground">
                The flashing light &amp; alarm stay active while SOS is on.
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
