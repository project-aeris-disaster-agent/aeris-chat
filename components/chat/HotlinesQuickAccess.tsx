"use client";

import * as React from "react";
import { Phone, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type Hotline = {
  org: string;
  numbers: string[];
  kind: string;
  notes?: string;
};

type HotlineDirectory = {
  resolved: {
    region: string | null;
    nearestCity: string | null;
    cityForHotlines: string | null;
  };
  national: Hotline[];
  regional: Hotline[];
  city: Hotline[];
  advisory: string;
};

function telHref(raw: string): string | null {
  // "(02) 8911-1406" -> tel:0289111406 ; "911" -> tel:911 ; "+63 917..." -> tel:+63917...
  const cleaned = raw.replace(/\(0?2\)/, "02").replace(/[^\d+]/g, "");
  if (!cleaned || cleaned.length < 3) return null;
  return `tel:${cleaned}`;
}

function HotlineRow({ hotline }: { hotline: Hotline }) {
  return (
    <div className="rounded-md border border-border bg-background/60 px-3 py-2">
      <p className="text-xs font-semibold text-foreground">{hotline.org}</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {hotline.numbers.map((num) => {
          const href = telHref(num);
          return href ? (
            <a
              key={num}
              href={href}
              className="inline-flex items-center gap-1 rounded border border-border bg-muted px-2 py-0.5 text-xs font-medium text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
            >
              <Phone className="h-3 w-3" aria-hidden />
              {num}
            </a>
          ) : (
            <span key={num} className="px-2 py-0.5 text-xs text-muted-foreground">
              {num}
            </span>
          );
        })}
      </div>
      {hotline.notes && (
        <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{hotline.notes}</p>
      )}
    </div>
  );
}

function Tier({ title, hotlines }: { title: string; hotlines: Hotline[] }) {
  if (hotlines.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </p>
      {hotlines.map((h) => (
        <HotlineRow key={h.org} hotline={h} />
      ))}
    </div>
  );
}

export function HotlinesQuickAccess({
  position,
}: {
  /** [lng, lat] of the detected user location, when available. */
  position: [number, number] | null;
}) {
  const [open, setOpen] = React.useState(false);
  const [directory, setDirectory] = React.useState<HotlineDirectory | null>(null);
  const [loading, setLoading] = React.useState(false);

  const posKey = position ? `${position[0]},${position[1]}` : "";

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const params = position ? `?lat=${position[1]}&lng=${position[0]}` : "";
    fetch(`/api/hotlines${params}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setDirectory(data as HotlineDirectory);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, posKey]);

  const localLabel =
    directory?.resolved.cityForHotlines ??
    (directory?.resolved.region ? `Region ${directory.resolved.region}` : null);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={() => setOpen(true)}
        className="h-10 w-10 rounded-full bg-background/80 shadow-sm backdrop-blur-sm md:h-9 md:w-9"
        aria-label="Emergency hotlines quick access"
      >
        <Phone className="h-5 w-5 md:h-4 md:w-4" />
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-[10000] flex items-start justify-center bg-black/50 p-4 pt-[max(4rem,env(safe-area-inset-top))] backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Emergency hotlines"
          onClick={() => setOpen(false)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-lg border border-border bg-background shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div>
                <p className="text-sm font-bold text-foreground">Emergency Hotlines</p>
                <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                  {localLabel ? `Near you: ${localLabel}` : "National directory"} · verified 2026
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => setOpen(false)}
                aria-label="Close hotlines"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {loading && !directory && (
                <p className="text-xs text-muted-foreground">Loading directory…</p>
              )}
              {directory && (
                <>
                  <Tier title="Your city" hotlines={directory.city} />
                  <Tier title="Your region" hotlines={directory.regional} />
                  <Tier title="Nationwide" hotlines={directory.national} />
                  <p className="text-[10px] leading-snug text-muted-foreground">
                    {directory.advisory}
                  </p>
                </>
              )}
              {!loading && !directory && (
                <p className="text-xs text-muted-foreground">
                  Could not load the directory. In an emergency, call <strong>911</strong>.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
