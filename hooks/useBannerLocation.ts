"use client";

import { useCallback, useEffect, useState } from "react";
import {
  buildBannerMetadataLine,
  buildLocationDisplayLine,
  clearIpLocationCache,
  detectUserLocation,
  getIpLocation,
} from "@/lib/location/detect-location";

const METADATA_LINE = buildBannerMetadataLine();
const DETECTING_LOCATION_LINE = "Detecting location…";

export function useBannerLocation() {
  const [locationLine, setLocationLine] = useState(DETECTING_LOCATION_LINE);
  const [isDetecting, setIsDetecting] = useState(true);

  const runDetection = useCallback(async (options?: { allowBrowserPrompt?: boolean; clearCache?: boolean }) => {
    setIsDetecting(true);
    setLocationLine(DETECTING_LOCATION_LINE);

    if (options?.clearCache) {
      clearIpLocationCache();
    }

    const ipLocation = await getIpLocation();
    const location = await detectUserLocation({
      allowBrowserPrompt: options?.allowBrowserPrompt,
    });
    const displayLine = await buildLocationDisplayLine(location, ipLocation?.label);

    setLocationLine(displayLine);
    setIsDetecting(false);
  }, []);

  useEffect(() => {
    void runDetection();
  }, [runDetection]);

  const redetect = useCallback(async () => {
    await runDetection({ allowBrowserPrompt: true, clearCache: true });
  }, [runDetection]);

  return {
    metadataLine: METADATA_LINE,
    locationLine,
    isDetecting,
    redetect,
  };
}
