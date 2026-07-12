"use client";

import React from "react";
import L from "leaflet";
import { MapContainer, TileLayer, ZoomControl, useMap } from "react-leaflet";
import { Loader2, MapPin, RefreshCw, Locate } from "lucide-react";
import { cn } from "@/lib/utils";

type ReportPoint = {
  position: [number, number];
  category: string;
  createdAt: string;
  verified: boolean;
  confirmations: number;
};

type ReportsResponse = {
  points: ReportPoint[];
  count: number;
  available: boolean;
  generatedAt: string;
};

const PH_CENTER: [number, number] = [12.8797, 121.774];
const PH_ZOOM = 5.5;
// Padded bounding box around the Philippine archipelago (Batanes → Tawi-Tawi,
// Kalayaan → eastern Mindanao). The map is locked inside this so users can't
// pan off to the rest of the world.
const PH_BOUNDS: L.LatLngBoundsExpression = [
  [4.2, 116.0],
  [21.5, 127.8],
];
const RECENT_MS = 24 * 60 * 60 * 1000; // 24h — "recent" pings render emphasized
const PULSE_MAX = 25; // cap animated halos so dense feeds stay light

type CityJump = { label: string; lat: number; lng: number; zoom: number };

// Quick-jump targets spanning Luzon, Visayas, and Mindanao. First entry resets
// to the whole country.
const CITY_JUMPS: CityJump[] = [
  { label: "Metro Manila", lat: 14.5995, lng: 120.9842, zoom: 10 },
  { label: "Naga", lat: 13.6192, lng: 123.1814, zoom: 12 },
  { label: "Legazpi", lat: 13.139, lng: 123.744, zoom: 12 },
  { label: "Baguio", lat: 16.4023, lng: 120.596, zoom: 12 },
  { label: "Cebu", lat: 10.3157, lng: 123.8854, zoom: 11 },
  { label: "Iloilo", lat: 10.7202, lng: 122.5621, zoom: 12 },
  { label: "Bacolod", lat: 10.6407, lng: 122.9689, zoom: 12 },
  { label: "Tacloban", lat: 11.242, lng: 125.0036, zoom: 12 },
  { label: "Davao", lat: 7.1907, lng: 125.4553, zoom: 11 },
  { label: "Cagayan de Oro", lat: 8.4542, lng: 124.6319, zoom: 11 },
  { label: "Zamboanga", lat: 6.9214, lng: 122.079, zoom: 12 },
  { label: "General Santos", lat: 6.1164, lng: 125.1716, zoom: 12 },
];

type FlyTarget = { lat: number; lng: number; zoom: number; key: number };

// Match the AERIS Dashboard ping palette.
const PING_FILL = "#ef4444";
const PING_STROKE = "#fecaca";

function relativeTime(iso: string): string {
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return "";
  const diff = Date.now() - then;
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}

/** Keeps Leaflet sized correctly while the modal container settles. */
function InvalidateMapSize() {
  const map = useMap();
  React.useEffect(() => {
    const fix = () => map.invalidateSize({ animate: false });
    fix();
    const raf = requestAnimationFrame(fix);
    const timers = [50, 250, 500, 1000].map((ms) => window.setTimeout(fix, ms));
    window.addEventListener("resize", fix);
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach((t) => window.clearTimeout(t));
      window.removeEventListener("resize", fix);
    };
  }, [map]);
  return null;
}

/**
 * Moves the map to a quick-jump target whenever the selection changes. Uses an
 * animated `setView` rather than `flyTo`: with the hard PH lock
 * (maxBoundsViscosity 1), flyTo's zoom-out arc gets clamped mid-animation and
 * never reaches the target, whereas setView jumps straight to the in-bounds
 * destination.
 */
function MapController({ target }: { target: FlyTarget | null }) {
  const map = useMap();
  React.useEffect(() => {
    if (!target) return;
    map.setView([target.lat, target.lng], target.zoom, { animate: true });
  }, [target, map]);
  return null;
}

function PingLayer({ points }: { points: ReportPoint[] }) {
  const map = useMap();

  React.useEffect(() => {
    if (points.length === 0) return;

    const group = L.layerGroup();
    let pulsed = 0;

    for (const p of points) {
      const [lng, lat] = p.position;
      const recent = Date.now() - Date.parse(p.createdAt) < RECENT_MS;
      const rel = relativeTime(p.createdAt);
      const popupHtml =
        `<div style="min-width:120px">` +
        `<strong style="text-transform:capitalize">${escapeHtml(p.category)}</strong>` +
        `<div style="color:#6b7280;font-size:11px;margin-top:2px">${escapeHtml(rel)}</div>` +
        (p.verified ? `<div style="color:#059669;font-size:11px">✓ Verified</div>` : "") +
        (p.confirmations > 0
          ? `<div style="color:#6b7280;font-size:11px">${p.confirmations} confirmation${p.confirmations === 1 ? "" : "s"}</div>`
          : "") +
        `</div>`;

      const marker = L.circleMarker([lat, lng], {
        radius: recent ? 6 : 4.5,
        color: PING_STROKE,
        weight: 1.5,
        fillColor: PING_FILL,
        fillOpacity: recent ? 0.95 : 0.7,
      }).bindPopup(popupHtml);
      group.addLayer(marker);

      // Give the most recent pings an animated halo for a live "ping" feel.
      if (recent && pulsed < PULSE_MAX) {
        pulsed += 1;
        const halo = L.marker([lat, lng], {
          interactive: false,
          keyboard: false,
          icon: L.divIcon({
            className: "",
            iconSize: [18, 18],
            html:
              `<span class="relative flex h-[18px] w-[18px]">` +
              `<span class="absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-60 animate-ping"></span>` +
              `</span>`,
          }),
        });
        group.addLayer(halo);
      }
    }

    group.addTo(map);
    return () => {
      map.removeLayer(group);
    };
  }, [map, points]);

  return null;
}

export function ReportPingsPanel() {
  const [data, setData] = React.useState<ReportsResponse | null>(null);
  const [status, setStatus] = React.useState<"loading" | "ready" | "error">("loading");
  const [target, setTarget] = React.useState<FlyTarget | null>(null);
  const [activeCity, setActiveCity] = React.useState<string | null>(null);

  const flyTo = React.useCallback((city: CityJump | null) => {
    if (!city) {
      setActiveCity(null);
      setTarget({ lat: PH_CENTER[0], lng: PH_CENTER[1], zoom: PH_ZOOM, key: Date.now() });
      return;
    }
    setActiveCity(city.label);
    setTarget({ lat: city.lat, lng: city.lng, zoom: city.zoom, key: Date.now() });
  }, []);

  const load = React.useCallback(async () => {
    setStatus("loading");
    try {
      const res = await fetch("/api/reports/public", { cache: "no-store" });
      if (!res.ok) throw new Error(`reports ${res.status}`);
      const json = (await res.json()) as ReportsResponse;
      setData(json);
      setStatus("ready");
    } catch (error) {
      console.error("Report pings load failed:", error);
      setStatus("error");
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const points = data?.points ?? [];
  const recentCount = points.filter(
    (p) => Date.now() - Date.parse(p.createdAt) < RECENT_MS,
  ).length;
  const generatedLabel = data?.generatedAt
    ? new Date(data.generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="flex h-full w-full flex-col">
      {/* City quick-jump toolbar */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-border bg-background/60 px-2 py-1.5">
        <button
          type="button"
          onClick={() => flyTo(null)}
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
            activeCity === null
              ? "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
              : "border-border bg-muted/50 text-foreground hover:bg-muted",
          )}
        >
          <Locate className="h-3 w-3" />
          Philippines
        </button>
        {CITY_JUMPS.map((city) => {
          const isActive = activeCity === city.label;
          return (
            <button
              key={city.label}
              type="button"
              onClick={() => flyTo(city)}
              aria-pressed={isActive}
              className={cn(
                "inline-flex shrink-0 items-center rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                isActive
                  ? "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                  : "border-border bg-muted/50 text-foreground hover:bg-muted",
              )}
            >
              {city.label}
            </button>
          );
        })}
      </div>

      <div className="relative min-h-0 flex-1">
        <MapContainer
          center={PH_CENTER}
          zoom={PH_ZOOM}
          minZoom={5}
          maxZoom={16}
          maxBounds={PH_BOUNDS}
          maxBoundsViscosity={1.0}
          scrollWheelZoom
          preferCanvas
          zoomControl={false}
          className="z-0 h-full w-full bg-muted/30"
        >
          <InvalidateMapSize />
          <MapController target={target} />
          {/* Top-right keeps the zoom control clear of the info panel. */}
          <ZoomControl position="topright" />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {status === "ready" && <PingLayer points={points} />}
        </MapContainer>

      {/* Info overlay (left-stacked so it never collides with the top-right
          zoom control) */}
      <div className="pointer-events-none absolute left-2 top-2 z-[500] flex flex-col items-start gap-1.5">
        <div className="pointer-events-auto flex items-center gap-1.5 rounded-md border border-border bg-background/90 px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm backdrop-blur">
          <MapPin className="h-3.5 w-3.5 text-red-500" />
          {status === "loading" && "Loading reports…"}
          {status === "error" && "Couldn't load reports"}
          {status === "ready" && `${points.length} report${points.length === 1 ? "" : "s"}`}
          <span className="ml-1 border-l border-border pl-1.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
            View only
          </span>
        </div>
        {status === "ready" && points.length > 0 && (
          <div className="pointer-events-none flex items-center gap-1.5 rounded-md border border-border bg-background/90 px-2.5 py-1 text-[10px] text-muted-foreground shadow-sm backdrop-blur">
            <span className="inline-block h-2 w-2 rounded-full bg-red-500 ring-2 ring-red-200" />
            <span>{recentCount} in last 24h · tap a ping for details</span>
          </div>
        )}
      </div>

      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 z-[400] flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading report pings…
        </div>
      )}

      {status === "error" && (
        <div className="absolute inset-0 z-[400] flex flex-col items-center justify-center gap-3 bg-background/60 text-sm text-muted-foreground">
          <p>Report map is temporarily unavailable.</p>
          <button
            type="button"
            onClick={() => void load()}
            className="pointer-events-auto inline-flex items-center gap-1.5 rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      )}

      {status === "ready" && points.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-[400] flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
          No community reports to show yet. New reports appear here as they come in.
        </div>
      )}

      {generatedLabel && status === "ready" && (
        <div className="pointer-events-none absolute bottom-1 left-2 z-[500] rounded bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground backdrop-blur">
          Updated {generatedLabel}
        </div>
      )}
      </div>
    </div>
  );
}
