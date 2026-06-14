"use client";

import React, { useState } from "react";
import { X, ExternalLink, CloudRain, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ForecastPanelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PANAHON_URL = "https://www.panahon.gov.ph/";

const PAGASA_QUICK_LINKS: Array<{ label: string; url: string }> = [
  { label: "Severe Weather Bulletin", url: "https://www.pagasa.dost.gov.ph/tropical-cyclone/severe-weather-bulletin" },
  { label: "Daily Weather Forecast", url: "https://www.pagasa.dost.gov.ph/weather" },
  { label: "Rainfall / Thunderstorm", url: "https://www.pagasa.dost.gov.ph/weather#rainfall-warning" },
  { label: "Tropical Cyclone Tracker", url: "https://www.pagasa.dost.gov.ph/tropical-cyclone/tropical-cyclone-tracking" },
];

export function ForecastPanelModal({ isOpen, onClose }: ForecastPanelModalProps) {
  const [isFrameLoading, setIsFrameLoading] = useState(true);

  if (!isOpen) return null;

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
          {/* Header */}
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3 md:px-6 md:py-4 flex-shrink-0">
            <div className="flex min-w-0 items-center gap-2">
              <CloudRain className="h-5 w-5 shrink-0 text-sky-500" />
              <div className="min-w-0">
                <h2 className="truncate text-base font-bold leading-tight text-foreground md:text-lg">
                  PANAHON · PAGASA Forecast
                </h2>
                <p className="truncate text-xs text-muted-foreground">
                  Official Philippine weather and tropical cyclone bulletins
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <a
                href={PANAHON_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-500/10 dark:text-sky-300"
                title="Open in new tab"
              >
                <ExternalLink className="h-4 w-4" />
                <span className="hidden sm:inline">Open site</span>
              </a>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close forecast panel"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Quick links */}
          <div className="flex flex-wrap gap-1.5 border-b border-border px-4 py-2 md:px-6 flex-shrink-0">
            {PAGASA_QUICK_LINKS.map((link) => (
              <a
                key={link.url}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted"
              >
                {link.label}
                <ExternalLink className="h-3 w-3 opacity-60" />
              </a>
            ))}
          </div>

          {/* Embedded forecast */}
          <div className="relative flex-1 min-h-0 bg-muted/30">
            {isFrameLoading && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading PANAHON forecast…
              </div>
            )}
            <iframe
              src={PANAHON_URL}
              title="PANAHON Forecast"
              className="h-full w-full border-0"
              onLoad={() => setIsFrameLoading(false)}
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>

          <div className="border-t border-border px-4 py-2 md:px-6 flex-shrink-0">
            <p className="text-[11px] leading-snug text-muted-foreground">
              Source: PAGASA / PANAHON (panahon.gov.ph). Not an official AERIS
              product — always follow PAGASA, NDRRMC, and your LGU for evacuation
              orders.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
