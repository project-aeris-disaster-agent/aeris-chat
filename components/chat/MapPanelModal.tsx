"use client";

import React, { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { X, ExternalLink, Loader2, Map } from "lucide-react";
import { cn } from "@/lib/utils";
import adsBanner from "@/assets/ads_v2_2026.gif";

// Leaflet must stay client-only; load the pings panel lazily so the map
// libraries aren't pulled into the initial bundle.
const ReportPingsPanel = dynamic(
  () => import("./ReportPingsPanel").then((m) => m.ReportPingsPanel),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading report pings…
      </div>
    ),
  },
);

interface MapPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HAZARD_HUNTER_MAP_URL = "https://hazardhunter.georisk.gov.ph/map";
const PANAHON_MAP_URL = "https://www.panahon.gov.ph/";

type MapSource =
  | { id: string; label: string; kind: "iframe"; url: string }
  | { id: string; label: string; kind: "pings" };

const MAP_SOURCES: MapSource[] = [
  { id: "panahon", label: "PANAHON Weather Map", kind: "iframe", url: PANAHON_MAP_URL },
  { id: "hazard", label: "Hazard Map", kind: "iframe", url: HAZARD_HUNTER_MAP_URL },
  { id: "pings", label: "Report Pings", kind: "pings" },
];

export function MapPanelModal({ isOpen, onClose }: MapPanelModalProps) {
  const [activeId, setActiveId] = useState<string>(MAP_SOURCES[0].id);
  const [isFrameLoading, setIsFrameLoading] = useState(true);

  const activeSource = useMemo(
    () => MAP_SOURCES.find((source) => source.id === activeId) ?? MAP_SOURCES[0],
    [activeId],
  );

  if (!isOpen) return null;

  const handleSelect = (id: string) => {
    if (id === activeId) return;
    setIsFrameLoading(true);
    setActiveId(id);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[10000] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="fixed inset-0 z-[10001] flex items-center justify-center p-2 md:p-4 pointer-events-none">
        <div
          className={cn(
            "bg-background border border-border rounded-lg shadow-xl",
            "w-full max-w-4xl h-[90dvh] md:h-[85dvh]",
            "flex flex-col pointer-events-auto overflow-hidden",
            "animate-in fade-in-0 zoom-in-95 duration-200",
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            aria-label="Advertisement"
            className="flex-shrink-0 w-full border-b border-border bg-background"
          >
            <Image
              src={adsBanner}
              alt="Report. Respond. Rebuild. Together."
              width={600}
              height={68}
              unoptimized
              priority
              sizes="(max-width: 896px) 100vw, 896px"
              className="block h-auto w-full min-w-0 object-contain"
            />
          </div>

          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 md:px-6 md:py-4 flex-shrink-0">
            <div className="flex min-w-0 items-center gap-2">
              <Map className="h-5 w-5 shrink-0 text-emerald-500" />
              <div className="min-w-0">
                <h2 className="truncate text-base font-bold leading-tight text-foreground md:text-lg">
                  Hazard & Weather Map
                </h2>
                <p className="truncate text-xs text-muted-foreground">
                  Official Philippine hazard, flood, and weather layers
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {activeSource.kind === "iframe" && (
                <a
                  href={activeSource.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-300"
                  title="Open in new tab"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span className="hidden sm:inline">Open site</span>
                </a>
              )}
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close map panel"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5 border-b border-border px-4 py-2 md:px-6 flex-shrink-0">
            {MAP_SOURCES.map((source) => {
              const isActive = source.id === activeId;
              return (
                <button
                  key={source.id}
                  type="button"
                  onClick={() => handleSelect(source.id)}
                  aria-pressed={isActive}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    isActive
                      ? "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                      : "border-border bg-muted/50 text-foreground hover:bg-muted",
                  )}
                >
                  {source.label}
                </button>
              );
            })}
          </div>

          <div className="relative flex-1 min-h-0 bg-muted/30">
            {activeSource.kind === "pings" ? (
              <ReportPingsPanel />
            ) : (
              <>
                {isFrameLoading && (
                  <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading {activeSource.label}…
                  </div>
                )}
                <iframe
                  key={activeSource.url}
                  src={activeSource.url}
                  title={activeSource.label}
                  className="h-full w-full border-0"
                  onLoad={() => setIsFrameLoading(false)}
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </>
            )}
          </div>

          <div className="border-t border-border px-4 py-2 md:px-6 flex-shrink-0">
            <p className="text-[11px] leading-snug text-muted-foreground">
              {activeSource.kind === "pings"
                ? "Report Pings shows individual community-submitted reports (view only). Not an official AERIS product — always follow PAGASA, NDRRMC, and your LGU for evacuation orders."
                : "Sources: PANAHON & PAGASA (DOST), HazardHunterPH (GeoRisk Philippines / PHIVOLCS). Not an official AERIS product — always follow PAGASA, NDRRMC, and your LGU for evacuation orders."}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
