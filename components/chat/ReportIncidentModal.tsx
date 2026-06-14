"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ImagePlus,
  Loader2,
  LocateFixed,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getAnonymousSessionId } from "@/lib/utils/anonymous-session";
import { mapInteractionGuard } from "./location-map-guard";
import aerisAdsBanner from "@/assets/ads_v1_2026.gif";
import bagyoLogo from "@/assets/Bagyo Logo@5x.png";
import aerisAgentAvatar from "@/assets/AERIS_char.svg";

/** Draft details detected by AERIS, used to prefill the report form. */
export type ReportInitialDraft = {
  category?: string;
  description?: string;
  locationHint?: string | null;
};

type ReportIncidentModalProps = {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
  onSubmitted?: () => void;
  initialPhotoFile?: File | null;
  onInitialPhotoConsumed?: () => void;
  /** Prefill the form from an AERIS-detected incident draft. */
  initialDraft?: ReportInitialDraft | null;
  onInitialDraftConsumed?: () => void;
  /** When true, run the step-by-step walkthrough after the modal opens. */
  startTutorial?: boolean;
};

type TutorialTarget = "category" | "location" | "photo" | "description" | "submit";

type TutorialStep = {
  target: TutorialTarget;
  title: string;
  body: string;
};

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    target: "category",
    title: "Step 1 · Situation type",
    body: "Pick the option that best matches what's happening. AERIS pre-selected one based on your message — change it if needed.",
  },
  {
    target: "location",
    title: "Step 2 · Location",
    body: "We auto-detect your location. Drag the map or search an address to pin the exact spot for responders.",
  },
  {
    target: "photo",
    title: "Step 3 · Photo evidence",
    body: "Add a photo if it's safe. Photos help operators verify the situation faster.",
  },
  {
    target: "description",
    title: "Step 4 · Description",
    body: "Briefly describe what's happening — landmarks, how urgent it is, and any visible risks.",
  },
  {
    target: "submit",
    title: "Step 5 · Send",
    body: "Tap Send report when you're ready. You can verify your phone later from the Report Inbox.",
  },
];

const CATEGORIES = [
  { value: "flood", label: "Flood", emoji: "🌊", dotColor: "bg-blue-500" },
  { value: "landslide", label: "Landslide", emoji: "⛰️", dotColor: "bg-amber-700" },
  { value: "stranded", label: "Stranded / Rescue Needed", emoji: "🆘", dotColor: "bg-orange-500" },
  { value: "SOS", label: "SOS / Life Threat", emoji: "🚨", dotColor: "bg-red-500" },
  { value: "infra_damage", label: "Infrastructure Damage", emoji: "🏚️", dotColor: "bg-amber-600" },
  { value: "power_out", label: "Power Outage", emoji: "⚡", dotColor: "bg-yellow-400" },
  { value: "road_closed", label: "Road Closed", emoji: "🚧", dotColor: "bg-yellow-500" },
  { value: "other", label: "Other", emoji: "📍", dotColor: "bg-gray-400" },
] as const;

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

type ReportFieldHint = "category" | "description" | "location";

function fieldHintFromApiError(message: string): { field: ReportFieldHint; message: string } | null {
  const lower = message.toLowerCase();
  if (lower.includes("description")) {
    return { field: "description", message };
  }
  if (lower.includes("position") || lower.includes("location")) {
    return { field: "location", message };
  }
  if (lower.includes("category")) {
    return { field: "category", message };
  }
  return null;
}

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

// Downscale + re-encode the image on the client to keep uploads small (free-tier
// friendly) and to strip EXIF/GPS metadata. Animated GIFs are passed through
// untouched so we don't flatten them to a single frame.
async function compressImage(file: File, maxDim = 1600, quality = 0.7): Promise<File> {
  if (file.type === "image/gif") return file;

  try {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Failed to read image"));
      reader.readAsDataURL(file);
    });

    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to decode image"));
      img.src = dataUrl;
    });

    const scale = Math.min(1, maxDim / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((result) => resolve(result), "image/jpeg", quality),
    );
    if (!blob) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "evidence";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
  } catch {
    // If anything goes wrong, fall back to the original file; the server still
    // validates type and size.
    return file;
  }
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
  initialPhotoFile,
  onInitialPhotoConsumed,
  initialDraft,
  onInitialDraftConsumed,
  startTutorial,
}: ReportIncidentModalProps) {
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [tutorialStep, setTutorialStep] = useState<number | null>(null);
  const categorySectionRef = useRef<HTMLDivElement>(null);
  const locationSectionRef = useRef<HTMLDivElement>(null);
  const photoSectionRef = useRef<HTMLDivElement>(null);
  const descriptionSectionRef = useRef<HTMLLabelElement>(null);
  const submitSectionRef = useRef<HTMLDivElement>(null);
  const draftAppliedRef = useRef(false);
  const [status, setStatus] = useState<{ tone: "ok" | "error"; message: string } | null>(null);
  const [fieldHint, setFieldHint] = useState<{
    field: ReportFieldHint;
    message: string;
  } | null>(null);
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
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const isPhoneNumberReady = phoneNumber.replace(/\D/g, "").length >= 11;

  const clearPhoto = useCallback(() => {
    setPhotoPreview((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setPhotoUrl(null);
    setPhotoError(null);
  }, []);

  const uploadPhoto = useCallback(async (file: File) => {
    setPhotoError(null);
    setPhotoUploading(true);
    try {
      const compressed = await compressImage(file);
      const formData = new FormData();
      formData.append("file", compressed);
      formData.append("anonymousId", getAnonymousSessionId());

      const response = await fetch("/api/reports/photo", {
        method: "POST",
        body: formData,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(body.error ?? `Photo upload failed (${response.status})`);
      }

      setPhotoUrl(body.photoUrl);
      setPhotoPreview((current) => {
        if (current) URL.revokeObjectURL(current);
        return URL.createObjectURL(compressed);
      });
    } catch (error) {
      setPhotoError((error as Error).message);
    } finally {
      setPhotoUploading(false);
    }
  }, []);

  const onPhotoSelected = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setPhotoError("Please choose an image file.");
        return;
      }
      void uploadPhoto(file);
    },
    [uploadPhoto],
  );

  const applyDetectedLocation = useCallback((location: DetectedLocation) => {
    setForm((current) => {
      if (current.locationSource === "manual" || mapInteractionGuard.active) {
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

  // When the modal is opened with a photo captured from the chat camera button,
  // upload it immediately so it appears pre-attached.
  useEffect(() => {
    if (!isOpen || !initialPhotoFile) return;
    void uploadPhoto(initialPhotoFile);
    onInitialPhotoConsumed?.();
  }, [isOpen, initialPhotoFile, uploadPhoto, onInitialPhotoConsumed]);

  useEffect(() => {
    if (!form.detectedLocationLabel) return;
    setLocationQuery(form.detectedLocationLabel);
  }, [form.detectedLocationLabel]);

  // Prefill the form from an AERIS-detected incident draft (category +
  // description). Applied once per open so it never clobbers user edits.
  useEffect(() => {
    if (!isOpen) {
      draftAppliedRef.current = false;
      return;
    }
    if (draftAppliedRef.current || !initialDraft) return;
    draftAppliedRef.current = true;

    const validCategory = CATEGORIES.some((c) => c.value === initialDraft.category);
    setForm((current) => ({
      ...current,
      category: validCategory ? (initialDraft.category as string) : current.category,
      description: initialDraft.description?.trim()
        ? initialDraft.description.trim()
        : current.description,
    }));
    if (initialDraft.locationHint && initialDraft.locationHint.trim()) {
      setLocationQuery(initialDraft.locationHint.trim());
    }
    onInitialDraftConsumed?.();
  }, [isOpen, initialDraft, onInitialDraftConsumed]);

  // Kick off the guided walkthrough once the modal is open.
  useEffect(() => {
    if (isOpen && startTutorial) {
      setTutorialStep(0);
    }
  }, [isOpen, startTutorial]);

  // When closed, reset form state so the next open starts clean.
  useEffect(() => {
    if (!isOpen) {
      setTutorialStep(null);
      setFieldHint(null);
      setForm(EMPTY_FORM);
      setStatus(null);
      setSubmittedReport(null);
      setPhoneNumber(DEFAULT_PHONE_PREFIX);
      setOtpCode("");
      setOtpStatus(null);
      setShowVerificationPopup(false);
      setLocationQuery("");
      clearPhoto();
    }
  }, [isOpen, clearPhoto]);

  // Scroll the highlighted section into view as the walkthrough advances.
  useEffect(() => {
    if (tutorialStep === null) return;
    const target = TUTORIAL_STEPS[tutorialStep]?.target;
    const node: HTMLElement | null =
      target === "category"
        ? categorySectionRef.current
        : target === "location"
          ? locationSectionRef.current
          : target === "photo"
            ? photoSectionRef.current
            : target === "description"
              ? descriptionSectionRef.current
              : target === "submit"
                ? submitSectionRef.current
                : null;
    node?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [tutorialStep]);

  const showFieldHelp = useCallback((hint: { field: ReportFieldHint; message: string }) => {
    setFieldHint(hint);
    setStatus(null);

    const targetRef =
      hint.field === "description"
        ? descriptionSectionRef
        : hint.field === "category"
          ? categorySectionRef
          : locationSectionRef;
    targetRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });

    requestAnimationFrame(() => {
      if (hint.field === "description") {
        descriptionSectionRef.current?.querySelector("textarea")?.focus();
      } else if (hint.field === "location") {
        locationSectionRef.current?.querySelector("input")?.focus();
      }
    });
  }, []);

  useEffect(() => {
    if (fieldHint?.field === "description" && form.description.trim()) {
      setFieldHint(null);
    }
    if (fieldHint?.field === "location" && form.position) {
      setFieldHint(null);
    }
  }, [form.description, form.position, fieldHint]);

  if (!isOpen) return null;

  const activeTutorial = tutorialStep !== null ? TUTORIAL_STEPS[tutorialStep] : null;
  const highlightTarget = activeTutorial?.target ?? null;
  // Spotlight effect: clean ring on the focused section, blur + dim the rest.
  const sectionTutorialClass = (target: TutorialTarget): string => {
    if (!activeTutorial) return "";
    return highlightTarget === target
      ? "relative z-10 rounded-xl ring-2 ring-primary ring-offset-4 ring-offset-background shadow-lg transition-all duration-300"
      : "pointer-events-none select-none opacity-40 blur-[2px] transition-all duration-300";
  };

  const endTutorial = () => setTutorialStep(null);
  const nextTutorialStep = () =>
    setTutorialStep((step) =>
      step === null || step >= TUTORIAL_STEPS.length - 1 ? null : step + 1,
    );
  const prevTutorialStep = () =>
    setTutorialStep((step) => (step === null || step <= 0 ? step : step - 1));

  const fieldHintClass = (field: ReportFieldHint): string =>
    fieldHint?.field === field
      ? "rounded-xl ring-2 ring-amber-500 ring-offset-2 ring-offset-background transition-shadow"
      : "";

  const fieldHintMessage = (field: ReportFieldHint): string | null =>
    fieldHint?.field === field ? fieldHint.message : null;

  const submitReport = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.description.trim()) {
      showFieldHelp({
        field: "description",
        message: "Add a brief description of what's happening before sending your report.",
      });
      return;
    }

    setSubmitting(true);
    setFieldHint(null);
    try {
      const detectedLocation = form.position ? null : await detectLocation({ allowBrowserPrompt: true });
      const position = form.position ?? detectedLocation?.position;

      if (!position) {
        showFieldHelp({
          field: "location",
          message: "Pin the incident on the map, search an address, or tap Auto-detect to set a location.",
        });
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
          photoUrl: photoUrl ?? undefined,
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

      onSubmitted?.();
      onClose();
    } catch (error) {
      const message = (error as Error).message;
      const fieldError = fieldHintFromApiError(message);
      if (fieldError) {
        showFieldHelp(fieldError);
      } else {
        setStatus({ tone: "error", message });
      }
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
            "max-h-[90vh] min-h-0",
          )}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <img
                  src={typeof bagyoLogo === "string" ? bagyoLogo : bagyoLogo.src}
                  alt="bagyo.app"
                  className="h-6 w-auto shrink-0 object-contain"
                />
                <h2 className="truncate text-lg font-bold leading-tight text-foreground sm:text-xl">
                  Submit Disaster Report
                </h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={onClose}
                aria-label="Close report form"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <p className="mt-1 text-xs leading-snug text-muted-foreground sm:text-sm">
              Public reports are sent to the dashboard as unverified intelligence.
            </p>
          </div>

          <form onSubmit={submitReport} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
            <div
              className={cn(
                "-mx-4 -mt-4 mb-1 overflow-hidden border-b border-border",
                activeTutorial && "pointer-events-none select-none opacity-40 blur-[2px] transition-all duration-300",
              )}
            >
              <img
                src={typeof aerisAdsBanner === "string" ? aerisAdsBanner : aerisAdsBanner.src}
                alt="Para sa impormasyon at tulong — disaster information and relief"
                className="h-auto w-full object-cover object-center"
              />
            </div>
            <div
              ref={categorySectionRef}
              className={cn(
                "space-y-2",
                fieldHintClass("category"),
                sectionTutorialClass("category"),
              )}
            >
              <span className="block text-sm font-medium">Situation type</span>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((category) => {
                  const selected = form.category === category.value;
                  return (
                    <button
                      key={category.value}
                      type="button"
                      onClick={() => setForm({ ...form, category: category.value })}
                      aria-pressed={selected}
                      className={cn(
                        "flex min-h-[3.25rem] items-center gap-2 rounded-lg border px-3 py-2.5 text-left transition-colors",
                        "bg-muted/40 hover:bg-muted/70 active:scale-[0.98]",
                        selected
                          ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                          : "border-border",
                      )}
                    >
                      <span
                        className={cn("h-2 w-2 shrink-0 rounded-full", category.dotColor)}
                        aria-hidden
                      />
                      <span className="shrink-0 text-base leading-none" aria-hidden>
                        {category.emoji}
                      </span>
                      <span className="text-sm font-semibold leading-tight text-foreground">
                        {category.label}
                      </span>
                    </button>
                  );
                })}
              </div>
              {fieldHintMessage("category") && (
                <p
                  role="status"
                  className="flex items-start gap-2 rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
                >
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>{fieldHintMessage("category")}</span>
                </p>
              )}
            </div>

            <div
              ref={locationSectionRef}
              className={cn(
                "space-y-2",
                fieldHintClass("location"),
                sectionTutorialClass("location"),
              )}
            >
              <div className="flex items-center gap-2">
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
                  {redetecting ? "Detecting..." : "Auto-detect"}
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
                  Drag the map to position the pin over the exact house or building.
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
                    : "Drag the map or search to set the incident location."}
              </div>
              {fieldHintMessage("location") && (
                <p
                  role="status"
                  className="flex items-start gap-2 rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
                >
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>{fieldHintMessage("location")}</span>
                </p>
              )}
            </div>

            <div
              ref={photoSectionRef}
              className={cn(
                "space-y-2",
                sectionTutorialClass("photo"),
              )}
            >
              <span className="block text-sm font-medium">Photo evidence (optional)</span>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={onPhotoSelected}
              />
              {photoPreview ? (
                <div className="relative w-full overflow-hidden rounded-md border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoPreview}
                    alt="Selected evidence preview"
                    className="max-h-48 w-full object-cover"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    onClick={clearPhoto}
                    className="absolute right-2 top-2 h-8 w-8"
                    aria-label="Remove photo"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => photoInputRef.current?.click()}
                  disabled={photoUploading}
                  className="w-full gap-2"
                >
                  {photoUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImagePlus className="h-4 w-4" />
                  )}
                  {photoUploading ? "Uploading..." : "Add photo"}
                </Button>
              )}
              {photoError && (
                <p className="text-xs text-red-600 dark:text-red-400">{photoError}</p>
              )}
              <p className="text-[10px] leading-tight text-muted-foreground">
                Photos help operators verify the situation. Avoid capturing faces or other
                sensitive details when possible.
              </p>
            </div>

            <label
              ref={descriptionSectionRef}
              className={cn(
                "block space-y-1 text-sm",
                fieldHintClass("description"),
                sectionTutorialClass("description"),
              )}
            >
              <span className="font-medium">Description</span>
              <textarea
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                maxLength={280}
                placeholder="What is happening? Include landmarks, urgency, and visible risks."
                className="min-h-24 w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              {fieldHintMessage("description") && (
                <p
                  role="status"
                  className="flex items-start gap-2 rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
                >
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>{fieldHintMessage("description")}</span>
                </p>
              )}
            </label>

            {submittedReport && !showVerificationPopup && (
              <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
                <p className="text-foreground">
                  Report ID: {submittedReport.messageId ?? submittedReport.id}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Phone verification is optional and can be done later from Report Inbox.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setShowVerificationPopup(true)}
                >
                  Verify phone (optional)
                </Button>
              </div>
            )}
            </div>

            <div
              ref={submitSectionRef}
              className={cn(
                "shrink-0 border-t border-border bg-background p-4",
                sectionTutorialClass("submit"),
              )}
            >
              {status?.tone === "error" && (
                <p className="mb-3 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                  {status.message}
                </p>
              )}

              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                  Close
                </Button>
                <Button
                  type="submit"
                  className="group relative isolate flex-1 overflow-hidden border-2 border-yellow-500 bg-[linear-gradient(110deg,#f59e0b,#fbbf24,#f59e0b)] bg-[length:200%_auto] font-bold text-black shadow-[0_4px_16px_-2px_rgba(245,158,11,0.5)] [animation:gradient_3s_ease_infinite] hover:bg-[position:right_center] hover:shadow-[0_6px_22px_-2px_rgba(245,158,11,0.85)] disabled:opacity-60"
                  disabled={submitting || (locating && !form.position)}
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-[linear-gradient(110deg,transparent,rgba(255,255,255,0.6),transparent)] [animation:gold-wipe_2.8s_ease-in-out_infinite]"
                  />
                  <span className="relative z-10">
                    {submitting ? "Sending..." : locating && !form.position ? "Detecting location..." : "Send report"}
                  </span>
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Guided walkthrough — floating agent avatar + speech bubble. */}
      {activeTutorial && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[10004] flex justify-center px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]">
          <div className="flex w-full max-w-lg items-end gap-1 sm:gap-2">
            <img
              src={
                typeof aerisAgentAvatar === "string"
                  ? aerisAgentAvatar
                  : aerisAgentAvatar.src
              }
              alt="A.E.R.I.S. agent"
              className="pointer-events-none h-28 w-auto shrink-0 select-none drop-shadow-2xl sm:h-36"
            />
            <div className="pointer-events-auto relative mb-3 flex-1 rounded-2xl border border-primary/40 bg-background/95 p-4 shadow-2xl backdrop-blur-sm">
              {/* Speech bubble tail pointing to the avatar */}
              <span
                aria-hidden
                className="absolute -left-1.5 bottom-6 h-3 w-3 rotate-45 border-b border-l border-primary/40 bg-background/95"
              />
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <p className="text-xs font-bold uppercase tracking-wide text-primary">
                    {activeTutorial.title}
                  </p>
                  <p className="mt-1 text-sm leading-snug text-foreground">
                    {activeTutorial.body}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={endTutorial}
                  className="-mr-1 -mt-1 shrink-0 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  Skip
                </button>
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">
                  {(tutorialStep ?? 0) + 1} of {TUTORIAL_STEPS.length}
                </span>
                <div className="flex items-center gap-2">
                  {(tutorialStep ?? 0) > 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 gap-1 px-2 text-xs"
                      onClick={prevTutorialStep}
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      Back
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 gap-1 px-3 text-xs"
                    onClick={nextTutorialStep}
                  >
                    {(tutorialStep ?? 0) >= TUTORIAL_STEPS.length - 1 ? (
                      "Got it"
                    ) : (
                      <>
                        Next
                        <ChevronRight className="h-3.5 w-3.5" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  Optional: verify your mobile number to help operators prioritize your report.
                </p>
                <div className="rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                  You can skip this step during an emergency. Unverified reports still appear on the dashboard.
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
