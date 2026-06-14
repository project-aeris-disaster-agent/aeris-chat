"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  buildBannerMetadataLine,
  buildLocationDisplayLine,
  clearIpLocationCache,
  detectUserLocation,
  getIpLocation,
} from "@/lib/location/detect-location";

const METADATA_LINE = buildBannerMetadataLine();
const DETECTING_LOCATION_LINE = "Detecting location…";
// Minimum gap between automatic refreshes triggered by focus/visibility so we
// don't keep the GPS radio spinning when the user toggles tabs rapidly.
const AUTO_REFRESH_MIN_INTERVAL_MS = 60_000;

export function useBannerLocation() {
  const [locationLine, setLocationLine] = useState(DETECTING_LOCATION_LINE);
  const [isDetecting, setIsDetecting] = useState(true);
  const [hasAccurateLocation, setHasAccurateLocation] = useState(false);
  const lastDetectAtRef = useRef(0);

  const runDetection = useCallback(async (options?: { allowBrowserPrompt?: boolean; clearCache?: boolean }) => {
    lastDetectAtRef.current = Date.now();
    setIsDetecting(true);
    setLocationLine(DETECTING_LOCATION_LINE);
    setHasAccurateLocation(false);

    if (options?.clearCache) {
      clearIpLocationCache();
    }

    const ipLocation = await getIpLocation();
    const location = await detectUserLocation({
      allowBrowserPrompt: options?.allowBrowserPrompt,
    });
    const displayLine = await buildLocationDisplayLine(location, ipLocation?.label);

    setLocationLine(displayLine);
    setHasAccurateLocation(location?.source === "browser");
    setIsDetecting(false);
  }, []);

  // Force a precise, freshly-acquired fix every time the app is opened, and
  // refresh it whenever the user returns to the tab/PWA so the banner always
  // reflects their current position.
  useEffect(() => {
    void runDetection({ allowBrowserPrompt: true, clearCache: true });

    if (typeof document === "undefined") return;

    const handleVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastDetectAtRef.current < AUTO_REFRESH_MIN_INTERVAL_MS) return;
      void runDetection({ allowBrowserPrompt: true, clearCache: true });
    };

    document.addEventListener("visibilitychange", handleVisible);
    window.addEventListener("focus", handleVisible);
    return () => {
      document.removeEventListener("visibilitychange", handleVisible);
      window.removeEventListener("focus", handleVisible);
    };
  }, [runDetection]);

  const redetect = useCallback(async () => {
    await runDetection({ allowBrowserPrompt: true, clearCache: true });
  }, [runDetection]);

  return {
    metadataLine: METADATA_LINE,
    locationLine,
    isDetecting,
    hasAccurateLocation,
    redetect,
  };
}
