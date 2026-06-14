"use client";

import React, { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  X,
  Search,
  Phone,
  Siren,
  HelpCircle,
  Radio,
  ShieldAlert,
  Flame,
  Shield,
  HeartPulse,
  Cross,
  type LucideIcon,
} from "lucide-react";
import {
  emergencyHotlines,
  HOTLINE_REGION_FILTERS,
  matchesHotlineRegionFilter,
  nagaQuickAccessHotlines,
  normalizePhoneNumber,
  sortHotlinesForNaga,
  type EmergencyHotline,
  type HotlineRegionFilter,
  type QuickAccessHotlineIcon,
} from "@/data/emergency-hotlines";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import adsBanner from "@/assets/ads_v2_2026.gif";
import bagyoLogo from "@/assets/Bagyo Logo@5x.png";
import { HotlineTutorialPopup } from "@/components/chat/HotlineTutorialPopup";

const HOTLINE_GUIDE_SEEN_KEY = "aeris_hotline_guide_seen";

const QUICK_ACCESS_ICONS: Record<QuickAccessHotlineIcon, LucideIcon> = {
  radio: Radio,
  "shield-alert": ShieldAlert,
  flame: Flame,
  shield: Shield,
  "heart-pulse": HeartPulse,
  cross: Cross,
};

const QUICK_ACCESS_ICON_STYLES: Record<
  QuickAccessHotlineIcon,
  { bg: string; text: string }
> = {
  radio: {
    bg: "bg-indigo-500/10",
    text: "text-indigo-600 dark:text-indigo-400",
  },
  "shield-alert": {
    bg: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
  },
  flame: {
    bg: "bg-orange-500/10",
    text: "text-orange-600 dark:text-orange-400",
  },
  shield: {
    bg: "bg-blue-500/10",
    text: "text-blue-600 dark:text-blue-400",
  },
  "heart-pulse": {
    bg: "bg-rose-500/10",
    text: "text-rose-600 dark:text-rose-400",
  },
  cross: {
    bg: "bg-red-500/10",
    text: "text-red-600 dark:text-red-400",
  },
};

interface EmergencyHotlinesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EmergencyHotlinesModal({ isOpen, onClose }: EmergencyHotlinesModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArea, setSelectedArea] = useState<HotlineRegionFilter>("naga-city");
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setSelectedArea("naga-city");

      // Auto-launch the guided tutorial the first time a user opens hotlines.
      try {
        if (!localStorage.getItem(HOTLINE_GUIDE_SEEN_KEY)) {
          setIsTutorialOpen(true);
          localStorage.setItem(HOTLINE_GUIDE_SEEN_KEY, "1");
        }
      } catch {
        // localStorage unavailable — skip auto-open silently.
      }
    }
  }, [isOpen]);

  const filteredHotlines = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = emergencyHotlines.filter((hotline) => {
      if (query) {
        const agencyMatch = hotline.agency.toLowerCase().includes(query);
        const hotlineMatch = hotline.hotline?.toLowerCase().includes(query);
        const trunkMatch = hotline.trunkDirectLine.some((line) =>
          line.toLowerCase().includes(query),
        );
        const areaMatch = hotline.area?.toLowerCase().includes(query);
        return agencyMatch || hotlineMatch || trunkMatch || areaMatch;
      }

      return matchesHotlineRegionFilter(hotline, selectedArea);
    });

    if (selectedArea === "naga-city") {
      filtered.sort(sortHotlinesForNaga);
    } else {
      filtered.sort((a, b) => a.agency.localeCompare(b.agency));
    }

    return filtered;
  }, [searchQuery, selectedArea]);

  const selectedFilterLabel =
    HOTLINE_REGION_FILTERS.find((filter) => filter.id === selectedArea)?.label ??
    "Hotlines";

  const handlePhoneClick = (phone: string) => {
    const normalized = normalizePhoneNumber(phone);
    // Check if it's a valid phone number (not a text instruction or empty)
    if (normalized && normalized.length > 0 && /^[\d+]+$/.test(normalized.replace(/\s/g, ''))) {
      window.location.href = `tel:${normalized}`;
    }
  };

  const handleCall911 = () => {
    window.location.href = "tel:911";
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[10000] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 pointer-events-none">
        <div
          className={cn(
            "bg-background border border-border rounded-lg shadow-xl",
            "w-full max-w-4xl h-[90vh]",
            "flex flex-col",
            "pointer-events-auto",
            "animate-in fade-in-0 zoom-in-95 duration-200",
            "overflow-hidden"
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

          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 md:px-4 md:py-3 border-b border-border flex-shrink-0">
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <Image
                src={bagyoLogo}
                alt="bagyo.app"
                width={600}
                height={180}
                className="h-8 w-auto shrink-0 object-contain md:h-9"
              />
              <div className="min-w-0">
                <h2 className="text-base md:text-xl font-bold leading-tight text-foreground">
                  Emergency HOTLINE Numbers
                </h2>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground md:text-xs">
                  Naga City &amp; Bicol disaster hotlines
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsTutorialOpen(true)}
                aria-label="Who to call? Open guide"
                className="h-7 w-7 border-muted-foreground/25"
              >
                <HelpCircle className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-7 w-7"
              >
                <X className="h-3.5 w-3.5" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
          </div>

          {/* Scrollable body: quick actions, filters, and hotline list */}
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            {/* Call 911 - Primary emergency action */}
            <div className="px-4 pt-4 md:px-6 md:pt-6">
            <button
              type="button"
              onClick={handleCall911}
              aria-label="Call 911 emergency hotline"
              className="group flex w-full items-center justify-center gap-3 rounded-xl px-4 py-3.5 text-white shadow-lg shadow-red-900/30 transition-transform hover:scale-[1.01] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 min-h-[52px]"
              style={{
                background:
                  "linear-gradient(90deg, #b91c1c 0%, #ef4444 50%, #b91c1c 100%)",
                backgroundSize: "200% 100%",
                animation: "gradient 3s ease infinite",
                border: "none",
              }}
            >
              <Siren className="h-6 w-6 shrink-0 transition-transform group-hover:scale-110" />
              <span className="text-base md:text-lg font-bold tracking-wide">
                Call 911
              </span>
            </button>
            <p className="mt-1.5 text-center text-[11px] text-muted-foreground md:text-xs">
              National emergency hotline · Police, fire &amp; medical
            </p>
          </div>

          {/* Naga City quick-dial */}
          <div className="px-4 pt-4 md:px-6 md:pt-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Quick access · Naga City
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {nagaQuickAccessHotlines.map((entry) => {
                const Icon = QUICK_ACCESS_ICONS[entry.icon];
                const iconStyle = QUICK_ACCESS_ICON_STYLES[entry.icon];
                return (
                  <button
                    key={entry.shortLabel}
                    type="button"
                    onClick={() => handlePhoneClick(entry.number)}
                    aria-label={`Call ${entry.label}: ${entry.number}`}
                    className="flex min-h-[52px] items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2 text-left shadow-sm transition-colors hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div
                      className={cn(
                        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                        iconStyle.bg,
                      )}
                    >
                      <Icon
                        className={cn("h-4 w-4", iconStyle.text)}
                        aria-hidden="true"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-foreground">
                        {entry.shortLabel}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 text-[11px] text-primary md:text-xs">
                        <Phone className="h-3 w-3 shrink-0" aria-hidden="true" />
                        {entry.number}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search and Filter */}
          <div className="mt-4 p-4 md:p-6 border-b border-border space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by agency, hotline, or number..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 h-10 md:h-11"
              />
            </div>

            {/* Region Filter */}
            <div className="flex flex-wrap gap-2">
              {HOTLINE_REGION_FILTERS.map((filter) => (
                <Button
                  key={filter.id}
                  variant={selectedArea === filter.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedArea(filter.id)}
                  className="text-xs md:text-sm"
                >
                  {filter.label}
                </Button>
              ))}
            </div>

            {/* Results count */}
            <p className="text-sm text-muted-foreground">
              {searchQuery.trim() ? (
                <>Showing {filteredHotlines.length} search results</>
              ) : (
                <>
                  Showing {filteredHotlines.length}{" "}
                  {selectedFilterLabel.toLowerCase()} hotline
                  {filteredHotlines.length === 1 ? "" : "s"}
                </>
              )}
            </p>
          </div>

          {/* Hotline list */}
          <div className="p-4 md:p-6">
            <div className="space-y-6">
              {filteredHotlines.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-muted-foreground">
                    No hotlines found matching your search.
                  </p>
                </div>
              ) : (
                filteredHotlines.map((hotline, index) => (
                  <HotlineCard
                    key={`${hotline.agency}-${index}`}
                    hotline={hotline}
                    onPhoneClick={handlePhoneClick}
                  />
                ))
              )}
            </div>
          </div>
          </div>
        </div>
      </div>

      <HotlineTutorialPopup
        isOpen={isTutorialOpen}
        onClose={() => setIsTutorialOpen(false)}
        onCall={handlePhoneClick}
      />
    </>
  );
}

interface HotlineCardProps {
  hotline: EmergencyHotline;
  onPhoneClick: (phone: string) => void;
}

function HotlineCard({ hotline, onPhoneClick }: HotlineCardProps) {
  const isClickable = (phone: string): boolean => {
    const normalized = normalizePhoneNumber(phone);
    return Boolean(
      normalized &&
        normalized.length > 0 &&
        /^[\d+]+$/.test(normalized.replace(/\s/g, "")),
    );
  };

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="space-y-3">
        {/* Agency Name */}
        <h3 className="text-base md:text-lg font-semibold text-foreground">
          {hotline.agency}
        </h3>

        {/* Hotline */}
        {hotline.hotline && (
          <div className="flex items-start gap-2">
            <span className="text-sm font-medium text-muted-foreground min-w-[80px]">
              Hotline:
            </span>
            <div className="flex-1">
              {isClickable(hotline.hotline) ? (
                <button
                  onClick={() => onPhoneClick(hotline.hotline!)}
                  className="text-sm md:text-base text-primary hover:underline flex items-center gap-2 group"
                >
                  <Phone className="h-3 w-3 md:h-4 md:w-4 group-hover:scale-110 transition-transform" />
                  {hotline.hotline}
                </button>
              ) : (
                <span className="text-sm md:text-base text-foreground">
                  {hotline.hotline}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Trunk & Direct Lines */}
        {hotline.trunkDirectLine.length > 0 && (
          <div className="flex items-start gap-2">
            <span className="text-sm font-medium text-muted-foreground min-w-[80px]">
              Numbers:
            </span>
            <div className="flex-1 space-y-1">
              {hotline.trunkDirectLine.map((line, idx) => (
                <div key={idx}>
                  {isClickable(line) ? (
                    <button
                      onClick={() => onPhoneClick(line)}
                      className="text-sm md:text-base text-primary hover:underline flex items-center gap-2 group w-full text-left"
                    >
                      <Phone className="h-3 w-3 md:h-4 md:w-4 group-hover:scale-110 transition-transform flex-shrink-0" />
                      <span>{line}</span>
                    </button>
                  ) : (
                    <span className="text-sm md:text-base text-foreground">
                      {line}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Area */}
        {hotline.area && (
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <span className="text-xs md:text-sm font-medium text-muted-foreground">
              Area:
            </span>
            <span className="text-xs md:text-sm text-foreground bg-muted px-2 py-1 rounded">
              {hotline.area}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

