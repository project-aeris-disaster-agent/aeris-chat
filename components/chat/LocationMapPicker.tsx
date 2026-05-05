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
    map.setView(center);
  }, [center, map]);

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
      scrollWheelZoom={true}
      className="h-56 w-full rounded-md border border-border"
    >
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
