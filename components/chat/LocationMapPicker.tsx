"use client";

import React from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

type LocationMapPickerProps = {
  center: [number, number];
  selected?: [number, number];
  onSelect: (position: [number, number]) => void;
};

function ClickToPin({ onSelect }: { onSelect: (position: [number, number]) => void }) {
  useMapEvents({
    click: (event) => {
      const latitude = Number(event.latlng.lat.toFixed(6));
      const longitude = Number(event.latlng.lng.toFixed(6));
      onSelect([longitude, latitude]);
    },
  });

  return null;
}

function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();

  React.useEffect(() => {
    map.invalidateSize({ animate: false });
    map.setView(center);
  }, [center, map]);

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
      map.invalidateSize({ animate: false });
    };

    fix();
    const raf = requestAnimationFrame(fix);
    // Spread invalidations across a wider window to cover:
    //   50ms - immediate layout settle
    //   250ms - typical CSS transition duration
    //   500ms - modal animation on slower devices
    //   1000ms - last-resort for very slow mobile (low-end Android, older iOS)
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

export function LocationMapPicker({ center, selected, onSelect }: LocationMapPickerProps) {
  const mapCenter: [number, number] = [center[1], center[0]];
  const selectedLongitude = selected?.[0] ?? center[0];
  const selectedLatitude = selected?.[1] ?? center[1];
  const selectedMarker = React.useMemo<[number, number]>(
    () => [selectedLatitude, selectedLongitude],
    [selectedLatitude, selectedLongitude],
  );
  const [markerPosition, setMarkerPosition] = React.useState<[number, number]>(selectedMarker);

  React.useEffect(() => {
    setMarkerPosition(selectedMarker);
  }, [selectedMarker]);

  const pinIcon = React.useMemo(
    () =>
      L.divIcon({
        className: "aeris-location-pin",
        iconSize: [28, 36],
        iconAnchor: [14, 35],
        html: `
          <div style="position:relative;width:28px;height:36px;">
            <div style="position:absolute;top:0;left:3px;width:22px;height:22px;border-radius:9999px;background:#ef4444;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>
            <div style="position:absolute;bottom:0;left:11px;width:0;height:0;border-left:4px solid transparent;border-right:4px solid transparent;border-top:12px solid #ef4444;"></div>
          </div>
        `,
      }),
    [],
  );

  return (
    <MapContainer
      center={mapCenter}
      zoom={13}
      // Disable scroll-wheel zoom to prevent it from stealing page scroll on
      // desktop, and to avoid conflicting with touch-scroll on mobile Safari /
      // Android WebView. Users can still zoom with pinch-to-zoom.
      scrollWheelZoom={false}
      className="z-0 h-56 min-h-56 w-full rounded-md border border-border"
    >
      <InvalidateMapSize />
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <RecenterMap center={mapCenter} />
      <ClickToPin
        onSelect={(position) => {
          setMarkerPosition([position[1], position[0]]);
          onSelect(position);
        }}
      />
      <Marker
        position={markerPosition}
        icon={pinIcon}
        draggable={false}
      />
    </MapContainer>
  );
}
