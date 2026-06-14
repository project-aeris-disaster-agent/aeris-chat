"use client";

import React from "react";
import { createPortal } from "react-dom";
import L from "leaflet";
import { MapContainer, TileLayer, useMap, useMapEvents } from "react-leaflet";

type LocationMapPickerProps = {
  center: [number, number];
  selected?: [number, number];
  onSelect: (position: [number, number]) => void;
};

import { mapInteractionGuard } from "./location-map-guard";

function MapInteractionFix() {
  const map = useMap();

  React.useEffect(() => {
    const container = map.getContainer();

    // Keep the map's own drag/scroll from bubbling to the modal's scroll
    // container, but DON'T add extra stopPropagation listeners — those can
    // swallow the pointer events Leaflet needs to start a drag.
    L.DomEvent.disableScrollPropagation(container);

    container.style.touchAction = "none";
    map.dragging.enable();

    const markInteractionStart = () => {
      mapInteractionGuard.active = true;
    };
    const markInteractionEnd = () => {
      mapInteractionGuard.active = false;
    };

    map.on("movestart", markInteractionStart);
    map.on("moveend", markInteractionEnd);

    return () => {
      mapInteractionGuard.active = false;
      container.style.touchAction = "";
      map.off("movestart", markInteractionStart);
      map.off("moveend", markInteractionEnd);
    };
  }, [map]);

  return null;
}

function SetPinOnInteraction({ onSelect }: { onSelect: (position: [number, number]) => void }) {
  const map = useMap();

  const commitCenter = React.useCallback(() => {
    mapInteractionGuard.active = false;
    const { lat, lng } = map.getCenter();
    onSelect([Number(lng.toFixed(6)), Number(lat.toFixed(6))]);
  }, [map, onSelect]);

  useMapEvents({
    // Drag the map → the center pin marks the spot.
    dragend: commitCenter,
    // Tap/click → recenter on that point and drop the pin there. Restores the
    // original tap-to-pin behaviour alongside the drag interaction.
    click: (event) => {
      mapInteractionGuard.active = true;
      map.panTo(event.latlng);
      const lng = Number(event.latlng.lng.toFixed(6));
      const lat = Number(event.latlng.lat.toFixed(6));
      onSelect([lng, lat]);
    },
  });

  return null;
}

function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();
  const centerKey = `${center[0].toFixed(6)},${center[1].toFixed(6)}`;
  const appliedKeyRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (mapInteractionGuard.active) return;
    if (appliedKeyRef.current === centerKey) return;

    const current = map.getCenter();
    const alreadyCentered =
      Math.abs(current.lat - center[0]) < 1e-5 && Math.abs(current.lng - center[1]) < 1e-5;

    appliedKeyRef.current = centerKey;

    map.invalidateSize({ animate: false });
    if (!alreadyCentered) {
      map.setView(center, map.getZoom(), { animate: false });
    }
  }, [center, centerKey, map]);

  return null;
}

/**
 * Leaflet measures the container on init; modals / overflow parents and slow
 * mobile devices need multiple invalidateSize calls spread across longer
 * intervals to ensure tiles render after CSS transitions settle.
 */
function InvalidateMapSize() {
  const map = useMap();

  React.useEffect(() => {
    const fix = () => {
      if (mapInteractionGuard.active) return;
      map.invalidateSize({ animate: false });
    };

    fix();
    const raf = requestAnimationFrame(fix);
    const t1 = window.setTimeout(fix, 50);
    const t2 = window.setTimeout(fix, 250);
    const t3 = window.setTimeout(fix, 500);
    const t4 = window.setTimeout(fix, 1000);

    window.addEventListener("resize", fix);
    window.addEventListener("orientationchange", fix);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
      window.clearTimeout(t4);
      window.removeEventListener("resize", fix);
      window.removeEventListener("orientationchange", fix);
    };
  }, [map]);

  return null;
}

function CenterPinOverlay() {
  const map = useMap();
  const [container, setContainer] = React.useState<HTMLElement | null>(null);

  React.useEffect(() => {
    setContainer(map.getContainer());
  }, [map]);

  if (!container) return null;

  return createPortal(
    <div
      className="pointer-events-none absolute inset-0 z-[401] flex items-center justify-center"
      style={{ pointerEvents: "none" }}
      aria-hidden
    >
      <div className="relative h-9 w-7 -translate-y-[35%]">
        <div className="absolute left-[3px] top-0 h-[22px] w-[22px] rounded-full border-2 border-white bg-red-500 shadow-[0_2px_6px_rgba(0,0,0,0.35)]" />
        <div className="absolute bottom-0 left-[11px] h-0 w-0 border-x-4 border-t-[12px] border-x-transparent border-t-red-500" />
      </div>
    </div>,
    container,
  );
}

export function LocationMapPicker({ center, selected, onSelect }: LocationMapPickerProps) {
  const mapCenter = React.useMemo<[number, number]>(
    () => [selected?.[1] ?? center[1], selected?.[0] ?? center[0]],
    [center, selected],
  );
  const initialCenterRef = React.useRef(mapCenter);

  return (
    <div className="relative touch-none overscroll-none">
      <MapContainer
        center={initialCenterRef.current}
        zoom={13}
        dragging
        scrollWheelZoom={false}
        className="z-0 h-56 min-h-56 w-full touch-none cursor-grab rounded-md border border-border active:cursor-grabbing"
      >
        <MapInteractionFix />
        <InvalidateMapSize />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <RecenterMap center={mapCenter} />
        <SetPinOnInteraction onSelect={onSelect} />
        <CenterPinOverlay />
      </MapContainer>
    </div>
  );
}
