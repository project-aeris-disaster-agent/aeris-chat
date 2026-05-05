"use client";

import React, { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { LocateFixed, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAnonymousSessionId } from "@/lib/utils/anonymous-session";
import { cn } from "@/lib/utils";
import banner2aeris from "@/assets/banner2aeris.jpg";

type ReportIncidentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
  onSubmitted?: () => void;
};

const CATEGORIES = [
  { value: "flood", label: "Flood" },
  { value: "landslide", label: "Landslide" },
  { value: "stranded", label: "Stranded / Rescue Needed" },
  { value: "SOS", label: "SOS / Life Threat" },
  { value: "infra_damage", label: "Infrastructure Damage" },
  { value: "power_out", label: "Power Outage" },
  { value: "road_closed", label: "Road Closed" },
];

type FormState = {
  category: string;
  description: string;
  position?: [number, number];
  locationAccuracyM?: number;
  locationSource?: "browser" | "ip" | "manual";
  detectedLocationLabel?: string;
  metadata?: Record<string, unknown>;
};

const EMPTY_FORM: FormState = {
  category: "flood",
  description: "",
};

type DetectedLocation = {
  position: [number, number];
  accuracyM?: number;
  source: "browser" | "ip";
  label: string;
  metadata: Record<string, unknown>;
};

type SubmittedReport = {
  id: string;
  messageId?: string;
};

const IP_LOCATION_ACCURACY_M = 25000
const IP_LOCATION_CACHE_KEY = 'aeris_ip_location_cache'
const IP_LOCATION_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_MAP_CENTER: [number, number] = [121.027802, 14.566146];
const DEFAULT_PHONE_PREFIX = "+63";

const LocationMapPicker = dynamic(
  async () => (await import("./LocationMapPicker")).LocationMapPicker,
  { ssr: false },
);

function formatCoordinatesLabel(position: [number, number]): string {
  const [longitude, latitude] = position;
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

async function getBrowserLocation(): Promise<DetectedLocation | null> {
  if (!navigator.geolocation) return null;

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

async function getGeolocationPermission(): Promise<PermissionState | "unsupported"> {
  if (!navigator.permissions?.query) return "unsupported";

  try {
    const result = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    return result.state;
  } catch {
    return "unsupported";
  }
}

type CachedIpLocation = DetectedLocation & { cachedAt: number };

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
    // sessionStorage unavailable — silently skip caching
  }
}

async function getIpLocation(): Promise<DetectedLocation | null> {
  const cached = readIpLocationCache();
  if (cached) return cached;

  const result = await fetchIpLocationFromServer();
  if (result) {
    writeIpLocationCache(result);
    return result;
  }

  const fallback = await fetchIpApiLocationDirect();
  if (fallback) {
    writeIpLocationCache(fallback);
    return fallback;
  }

  const last = await fetchIpWhoIsLocationDirect();
  if (last) writeIpLocationCache(last);
  return last;
}

async function fetchIpLocationFromServer(): Promise<DetectedLocation | null> {
  try {
    const response = await fetch("/api/location", { cache: "no-store" });
    if (!response.ok) return null;
    const data = await response.json();
    const longitude = Number(data.position?.[0]);
    const latitude = Number(data.position?.[1]);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;
    return {
      position: [longitude, latitude],
      accuracyM: data.accuracyM ?? IP_LOCATION_ACCURACY_M,
      source: "ip",
      label: data.label || "Approximate IP location detected",
      metadata: data.metadata ?? {},
    };
  } catch {
    return null;
  }
}

async function fetchIpApiLocationDirect(): Promise<DetectedLocation | null> {
  try {
    const response = await fetch("https://ipapi.co/json/", { cache: "no-store" });
    if (!response.ok) return null;

    const data = await response.json();
    const longitude = Number(data.longitude);
    const latitude = Number(data.latitude);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;

    const label = [data.city, data.region, data.country_name].filter(Boolean).join(", ");
    return {
      position: [longitude, latitude],
      accuracyM: IP_LOCATION_ACCURACY_M,
      source: "ip",
      label: label || "Approximate IP location detected",
      metadata: {
        clientIp: typeof data.ip === "string" ? data.ip : undefined,
        ipLocation: {
          provider: "ipapi.co",
          city: data.city,
          region: data.region,
          country: data.country_name,
          countryCode: data.country_code,
          latitude,
          longitude,
        },
      },
    };
  } catch {
    return null;
  }
}

async function fetchIpWhoIsLocationDirect(): Promise<DetectedLocation | null> {
  try {
    const response = await fetch("https://ipwho.is/", { cache: "no-store" });
    if (!response.ok) return null;

    const data = await response.json();
    const longitude = Number(data.longitude);
    const latitude = Number(data.latitude);
    if (!data.success || !Number.isFinite(longitude) || !Number.isFinite(latitude)) return null;

    const label = [data.city, data.region, data.country].filter(Boolean).join(", ");
    return {
      position: [longitude, latitude],
      accuracyM: IP_LOCATION_ACCURACY_M,
      source: "ip",
      label: label || "Approximate IP location detected",
      metadata: {
        clientIp: typeof data.ip === "string" ? data.ip : undefined,
        ipLocation: {
          provider: "ipwho.is",
          city: data.city,
          region: data.region,
          country: data.country,
          countryCode: data.country_code,
          latitude,
          longitude,
        },
      },
    };
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
      headers: {
        "accept-language": "en",
      },
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

async function searchLocationByAddress(query: string): Promise<{ position: [number, number]; label: string } | null> {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    limit: "1",
  });

  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      cache: "no-store",
      headers: {
        "accept-language": "en",
      },
    });
    if (!response.ok) return null;

    const data = (await response.json()) as Array<{ lat?: string; lon?: string; display_name?: string }>;
    const first = data[0];
    if (!first) return null;

    const latitude = Number(first.lat);
    const longitude = Number(first.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    return {
      position: [Number(longitude.toFixed(6)), Number(latitude.toFixed(6))],
      label: typeof first.display_name === "string" ? first.display_name : formatCoordinatesLabel([longitude, latitude]),
    };
  } catch {
    return null;
  }
}

export function ReportIncidentModal({
  isOpen,
  onClose,
  sessionId,
  onSubmitted,
}: ReportIncidentModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [submittedReport, setSubmittedReport] = useState<SubmittedReport | null>(null);
  const [phoneNumber, setPhoneNumber] = useState(DEFAULT_PHONE_PREFIX);
  const [otpCode, setOtpCode] = useState("");
  const [otpStatus, setOtpStatus] = useState<{ tone: "ok" | "error"; message: string } | null>(null);
  const [requestingOtp, setRequestingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [reverseGeocoding, setReverseGeocoding] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [showVerificationPopup, setShowVerificationPopup] = useState(false);
  const [redetecting, setRedetecting] = useState(false);
  const isPhoneNumberReady = phoneNumber.replace(/\D/g, "").length >= 11;

  const applyDetectedLocation = useCallback((location: DetectedLocation) => {
    setForm((current) => {
      if (current.locationSource === "manual") {
        return current;
      }

      return {
        ...current,
        position: location.position,
        locationAccuracyM: location.accuracyM,
        locationSource: location.source,
        detectedLocationLabel: location.label,
        metadata: {
          ...current.metadata,
          ...location.metadata,
          locationSource: location.source,
        },
      };
    });
  }, []);

  const detectLocation = useCallback(
    async ({ allowBrowserPrompt = false }: { allowBrowserPrompt?: boolean } = {}) => {
      setLocating(true);
      setStatus(null);

      try {
        const ipLocation = await getIpLocation();
        if (ipLocation) {
          applyDetectedLocation(ipLocation);
        }

        const permission = await getGeolocationPermission();
        const shouldUseBrowserLocation = permission === "granted" || allowBrowserPrompt;
        if (shouldUseBrowserLocation) {
          const browserLocation = await getBrowserLocation();
          if (browserLocation) {
            applyDetectedLocation({
              ...browserLocation,
              metadata: {
                ...ipLocation?.metadata,
                ...browserLocation.metadata,
                geolocationPermission: permission,
              },
            });
            return browserLocation;
          }
        }

        if (ipLocation) {
          return ipLocation;
        }

        setStatus({
          tone: "error",
          message: "Unable to detect your location automatically. Please check browser location access or network connectivity.",
        });
        return null;
      } finally {
        setLocating(false);
      }
    },
    [applyDetectedLocation],
  );

  const redetectLocation = useCallback(async () => {
    try {
      sessionStorage.removeItem(IP_LOCATION_CACHE_KEY);
    } catch {
      // ignore
    }
    setForm((current) => ({
      ...current,
      position: undefined,
      locationAccuracyM: undefined,
      locationSource: undefined,
      detectedLocationLabel: undefined,
    }));
    setLocationQuery("");
    setRedetecting(true);
    try {
      await detectLocation({ allowBrowserPrompt: true });
    } finally {
      setRedetecting(false);
    }
  }, [detectLocation]);

  const applyManualPinnedLocation = useCallback((position: [number, number], label?: string) => {
    const coordinateLabel = formatCoordinatesLabel(position);

    setForm((current) => ({
      ...current,
      position,
      locationAccuracyM: undefined,
      locationSource: "manual",
      detectedLocationLabel: label ?? `Pinned at ${coordinateLabel}`,
      metadata: {
        ...current.metadata,
        locationSource: "manual",
        mapPin: {
          latitude: position[1],
          longitude: position[0],
          pinnedAt: new Date().toISOString(),
        },
        ...(label ? { reverseGeocodedAddress: label } : {}),
      },
    }));
  }, []);

  const pinLocationFromMap = useCallback(async (position: [number, number]) => {
    const coordinateLabel = formatCoordinatesLabel(position);
    applyManualPinnedLocation(position);
    setLocationQuery(coordinateLabel);

    setReverseGeocoding(true);
    try {
      const resolvedLabel = await reverseGeocode(position);
      if (!resolvedLabel) return;

      setForm((current) => {
        if (!current.position) return current;
        const [currentLongitude, currentLatitude] = current.position;
        if (currentLongitude !== position[0] || currentLatitude !== position[1]) {
          return current;
        }

        return {
          ...current,
          detectedLocationLabel: resolvedLabel,
          metadata: {
            ...current.metadata,
            reverseGeocodedAddress: resolvedLabel,
          },
        };
      });
      setLocationQuery(resolvedLabel);
    } finally {
      setReverseGeocoding(false);
    }
  }, [applyManualPinnedLocation]);

  const searchAndPinLocation = useCallback(async () => {
    const query = locationQuery.trim();
    if (!query) {
      setStatus({ tone: "error", message: "Enter an address to search." });
      return;
    }

    setSearchingLocation(true);
    setStatus(null);
    try {
      const result = await searchLocationByAddress(query);
      if (!result) {
        setStatus({ tone: "error", message: "Address not found. Try a more specific location." });
        return;
      }

      applyManualPinnedLocation(result.position, result.label);
      setLocationQuery(result.label);
    } finally {
      setSearchingLocation(false);
    }
  }, [applyManualPinnedLocation, locationQuery]);

  useEffect(() => {
    if (!isOpen) return;
    void detectLocation();
  }, [detectLocation, isOpen]);

  useEffect(() => {
    if (!form.detectedLocationLabel) return;
    setLocationQuery(form.detectedLocationLabel);
  }, [form.detectedLocationLabel]);

  if (!isOpen) return null;

  const submitReport = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.description.trim()) {
      setStatus({ tone: "error", message: "Description is required." });
      return;
    }

    setSubmitting(true);
    try {
      const detectedLocation = form.position ? null : await detectLocation({ allowBrowserPrompt: true });
      const position = form.position ?? detectedLocation?.position;

      if (!position) {
        setStatus({ tone: "error", message: "Location could not be detected for this report." });
        return;
      }

      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category: form.category,
          description: form.description,
          position,
          locationAccuracyM: form.locationAccuracyM ?? detectedLocation?.accuracyM,
          anonymousId: getAnonymousSessionId(),
          sessionId: sessionId ?? undefined,
          metadata: {
            ...form.metadata,
            ...detectedLocation?.metadata,
          },
        }),
      });

      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error ?? `Report failed (${response.status})`);
      }

      setForm(EMPTY_FORM);
      const report = body.report ? { id: body.report.id, messageId: body.report.messageId } : null;
      setSubmittedReport(report);
      setPhoneNumber(DEFAULT_PHONE_PREFIX);
      setOtpCode("");
      setOtpStatus(null);
      setShowVerificationPopup(Boolean(report));
      onSubmitted?.();
      setStatus({
        tone: "ok",
        message: "Report sent to AERIS.",
      });
    } catch (error) {
      setStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  const requestOtp = async () => {
    if (!submittedReport) return;
    setRequestingOtp(true);
    setOtpStatus(null);

    try {
      const response = await fetch("/api/reports/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "request",
          reportId: submittedReport.id,
          anonymousId: getAnonymousSessionId(),
          phoneNumber,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error ?? `Unable to request OTP (${response.status})`);
      }

      setOtpStatus({
        tone: "ok",
        message: body.devOtpCode
          ? `Development OTP: ${body.devOtpCode}`
          : body.message ?? "OTP request recorded. SMS delivery will be enabled when the provider is configured.",
      });
    } catch (error) {
      setOtpStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setRequestingOtp(false);
    }
  };

  const verifyOtp = async () => {
    if (!submittedReport) return;
    setVerifyingOtp(true);
    setOtpStatus(null);

    try {
      const response = await fetch("/api/reports/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "verify",
          reportId: submittedReport.id,
          anonymousId: getAnonymousSessionId(),
          phoneNumber,
          otpCode,
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error ?? `Unable to verify OTP (${response.status})`);
      }

      setOtpStatus({
        tone: "ok",
        message: "Mobile verified. Proxy wallet assigned and BASE mint queued.",
      });
      setShowVerificationPopup(false);
      onSubmitted?.();
    } catch (error) {
      setOtpStatus({ tone: "error", message: (error as Error).message });
    } finally {
      setVerifyingOtp(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[10000] bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 pointer-events-none">
        <div
          className={cn(
            "pointer-events-auto flex w-full max-w-lg flex-col overflow-hidden rounded-lg border border-border bg-background shadow-xl",
            "max-h-[90vh]",
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-border p-4">
            <div>
              <h2 className="text-xl font-bold text-foreground">Submit Disaster Report</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Public reports are sent to the dashboard as unverified intelligence.
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close report form">
              <X className="h-5 w-5" />
            </Button>
          </div>

          <form onSubmit={submitReport} className="space-y-4 overflow-y-auto p-4">
            <div className="-mx-4 -mt-4 mb-1 overflow-hidden border-b border-border">
              <img
                src={typeof banner2aeris === "string" ? banner2aeris : banner2aeris.src}
                alt="Para sa impormasyon at tulong — disaster information and relief"
                className="h-auto w-full object-cover object-center"
              />
            </div>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">Situation type</span>
              <select
                value={form.category}
                onChange={(event) => setForm({ ...form, category: event.target.value })}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {CATEGORIES.map((category) => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1 text-sm">
              <span className="font-medium">Description</span>
              <textarea
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                maxLength={280}
                placeholder="What is happening? Include landmarks, urgency, and visible risks."
                className="min-h-24 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </label>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">Location</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void redetectLocation()}
                  disabled={locating || redetecting}
                  className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
                >
                  <LocateFixed className="h-3.5 w-3.5" />
                  {redetecting ? "Detecting..." : "Re-detect"}
                </Button>
              </div>
              <div className="flex gap-2">
                <Input
                  value={locationQuery}
                  onChange={(event) => setLocationQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void searchAndPinLocation();
                    }
                  }}
                  placeholder="Search or edit address"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void searchAndPinLocation()}
                  disabled={searchingLocation}
                  className="gap-2"
                >
                  <Search className="h-4 w-4" />
                  {searchingLocation ? "Searching..." : "Search"}
                </Button>
              </div>
              <div className="space-y-2 rounded-md border border-border bg-muted/20 p-2">
                <LocationMapPicker
                  center={form.position ?? DEFAULT_MAP_CENTER}
                  selected={form.position}
                  onSelect={(position) => void pinLocationFromMap(position)}
                />
                <p className="text-xs text-muted-foreground">
                  Tap the exact house or building on the map to place the pin.
                </p>
              </div>
              <div
                className={cn(
                  "rounded-md border-2 border-primary/45 bg-primary/[0.07] px-2 py-[5px] text-[10px] leading-tight text-muted-foreground shadow-sm",
                  "ring-1 ring-primary/20 dark:border-primary/55 dark:bg-primary/15 dark:ring-primary/25",
                )}
              >
                {locating
                  ? "Detecting location automatically..."
                  : reverseGeocoding
                    ? "Resolving pinned location details..."
                  : form.detectedLocationLabel
                    ? `${form.detectedLocationLabel}${
                        form.locationAccuracyM ? `, accuracy about ${form.locationAccuracyM}m` : ""
                      }`
                    : "Use the map pin or search to set the incident location."}
              </div>
            </div>

            {status && (
              <p
                className={cn(
                  "rounded-md border px-3 py-2 text-sm",
                  status.tone === "ok"
                    ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300"
                    : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
                )}
              >
                {status.message}
              </p>
            )}

            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                Close
              </Button>
              <Button type="submit" className="flex-1" disabled={submitting}>
                {submitting ? "Sending..." : "Send report"}
              </Button>
            </div>
          </form>
        </div>
      </div>
      {submittedReport && showVerificationPopup && (
        <>
          <div className="fixed inset-0 z-[10002] bg-black/45" />
          <div className="fixed inset-0 z-[10003] flex items-center justify-center p-4 pointer-events-none">
            <div
              className="pointer-events-auto w-full max-w-md rounded-lg border border-border bg-background shadow-xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="border-b border-border px-4 py-3">
                <h3 className="text-base font-semibold text-foreground">Verify mobile number</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Message ID: {submittedReport.messageId ?? submittedReport.id}
                </p>
              </div>
              <div className="space-y-3 p-4">
                <p className="text-sm text-muted-foreground">
                  Verify now to assign your BASE proxy wallet and queue gasless minting immediately.
                </p>
                <div className="rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  Verify later is allowed, but unverified reports are queued behind verified reports. Verified reports are processed first in first-in, first-out order.
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <Input
                    type="tel"
                    placeholder="PH mobile number"
                    value={phoneNumber}
                    onChange={(event) => setPhoneNumber(event.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void requestOtp()}
                    disabled={requestingOtp || !isPhoneNumberReady}
                  >
                    {requestingOtp ? "Sending..." : "Send OTP"}
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <Input
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="6-digit OTP"
                    value={otpCode}
                    onChange={(event) => setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  />
                  <Button
                    type="button"
                    onClick={() => void verifyOtp()}
                    disabled={verifyingOtp || otpCode.length !== 6 || !isPhoneNumberReady}
                  >
                    {verifyingOtp ? "Verifying..." : "Verify now"}
                  </Button>
                </div>
                {otpStatus && (
                  <p
                    className={cn(
                      "rounded-md border px-3 py-2 text-xs",
                      otpStatus.tone === "ok"
                        ? "border-green-500/30 bg-green-500/10 text-green-700 dark:text-green-300"
                        : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
                    )}
                  >
                    {otpStatus.message}
                  </p>
                )}
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                      setShowVerificationPopup(false);
                      setStatus({
                        tone: "ok",
                        message:
                          "Verification skipped for now. Unverified reports are queued after verified reports (FIFO within each queue).",
                      });
                    }}
                  >
                    Verify later
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
