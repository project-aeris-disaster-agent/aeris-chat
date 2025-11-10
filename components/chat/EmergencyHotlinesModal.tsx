"use client";

import React, { useState, useMemo } from "react";
import { X, Search, Phone } from "lucide-react";
import { emergencyHotlines, normalizePhoneNumber, type EmergencyHotline } from "@/data/emergency-hotlines";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface EmergencyHotlinesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function EmergencyHotlinesModal({ isOpen, onClose }: EmergencyHotlinesModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedArea, setSelectedArea] = useState<string>("all");

  // Extract top-level areas only (group NCR cities under NCR)
  const areas = useMemo(() => {
    const uniqueAreas = new Set<string>();
    emergencyHotlines.forEach((hotline) => {
      if (hotline.area) {
        // Normalize NCR - [City] and PASAY to just NCR (Pasay is in NCR)
        let topLevelArea = hotline.area;
        if (topLevelArea.startsWith("NCR") || topLevelArea === "PASAY") {
          topLevelArea = "NCR";
        }
        uniqueAreas.add(topLevelArea);
      }
    });
    return Array.from(uniqueAreas).sort((a, b) => {
      // Put NCR first, then sort others alphabetically
      if (a === "NCR") return -1;
      if (b === "NCR") return 1;
      return a.localeCompare(b);
    });
  }, []);

  // Helper function to extract city name from area for sorting
  const getCityName = (area: string): string => {
    if (area.startsWith("NCR - ")) {
      return area.replace("NCR - ", "");
    }
    if (area === "PASAY") {
      return "Pasay";
    }
    return "";
  };

  // Filter and sort hotlines based on search query and area
  const filteredHotlines = useMemo(() => {
    let filtered = emergencyHotlines.filter((hotline) => {
      // Area filter - group all NCR entries together (including PASAY)
      if (selectedArea !== "all") {
        let topLevelArea = hotline.area;
        if (topLevelArea?.startsWith("NCR") || topLevelArea === "PASAY") {
          topLevelArea = "NCR";
        }
        if (topLevelArea !== selectedArea) {
          return false;
        }
      }

      // Search filter
      if (!searchQuery.trim()) {
        return true;
      }

      const query = searchQuery.toLowerCase();
      const agencyMatch = hotline.agency.toLowerCase().includes(query);
      const hotlineMatch = hotline.hotline?.toLowerCase().includes(query);
      const trunkMatch = hotline.trunkDirectLine.some((line) =>
        line.toLowerCase().includes(query)
      );
      const areaMatch = hotline.area?.toLowerCase().includes(query);

      return agencyMatch || hotlineMatch || trunkMatch || areaMatch;
    });

    // Sort entries: NCR entries by city name, then agency name; others by agency name
    filtered.sort((a, b) => {
      const aArea = a.area || "";
      const bArea = b.area || "";
      const aCity = getCityName(aArea);
      const bCity = getCityName(bArea);
      const aIsNCR = aArea.startsWith("NCR") || aArea === "PASAY";
      const bIsNCR = bArea.startsWith("NCR") || bArea === "PASAY";
      
      // If both are NCR entries
      if (aIsNCR && bIsNCR) {
        // If both are cities, sort by city name first, then agency
        if (aCity && bCity) {
          const cityCompare = aCity.localeCompare(bCity);
          if (cityCompare !== 0) return cityCompare;
          return a.agency.localeCompare(b.agency);
        }
        // If only one is a city, put non-city NCR entries first
        if (aCity && !bCity) return 1;
        if (bCity && !aCity) return -1;
        // Both are non-city NCR entries, sort by agency
        return a.agency.localeCompare(b.agency);
      }
      
      // If only one is NCR, put NCR entries first
      if (aIsNCR && !bIsNCR) return -1;
      if (bIsNCR && !aIsNCR) return 1;
      
      // Default: sort by agency name
      return a.agency.localeCompare(b.agency);
    });

    return filtered;
  }, [searchQuery, selectedArea]);

  const handlePhoneClick = (phone: string) => {
    const normalized = normalizePhoneNumber(phone);
    // Check if it's a valid phone number (not a text instruction or empty)
    if (normalized && normalized.length > 0 && /^[\d+]+$/.test(normalized.replace(/\s/g, ''))) {
      window.location.href = `tel:${normalized}`;
    }
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
          {/* Header */}
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-border flex-shrink-0">
            <h2 className="text-xl md:text-2xl font-bold text-foreground">
              Emergency HOTLINE Numbers
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 md:h-10 md:w-10"
            >
              <X className="h-4 w-4 md:h-5 md:w-5" />
              <span className="sr-only">Close</span>
            </Button>
          </div>

          {/* Search and Filter */}
          <div className="p-4 md:p-6 border-b border-border space-y-4 flex-shrink-0">
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

            {/* Area Filter */}
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedArea === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedArea("all")}
                className="text-xs md:text-sm"
              >
                All Areas
              </Button>
              {areas.map((area) => (
                <Button
                  key={area}
                  variant={selectedArea === area ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedArea(area)}
                  className="text-xs md:text-sm"
                >
                  {area}
                </Button>
              ))}
            </div>

            {/* Results count */}
            <p className="text-sm text-muted-foreground">
              Showing {filteredHotlines.length} of {emergencyHotlines.length} entries
            </p>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <ScrollArea className="h-full p-4 md:p-6">
              <div className="space-y-6">
                {filteredHotlines.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">No hotlines found matching your search.</p>
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
            </ScrollArea>
          </div>
        </div>
      </div>
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
    return normalized && normalized.length > 0 && /^[\d+]+$/.test(normalized.replace(/\s/g, ''));
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

