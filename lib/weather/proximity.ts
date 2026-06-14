import { PH_MAJOR_CITIES, type PhMajorCity } from "@/data/ph-major-cities";
import type { ActiveCyclone } from "@/lib/weather/gdacs";
import { haversineKm } from "@/lib/weather/haversine";

const DEFAULT_TRACK_PROXIMITY_KM = 150;
const USER_DIRECT_HIT_KM = 100;

export type NearbyCityImpact = {
  name: string;
  region: string;
  distanceToTrackKm: number;
};

export type CycloneImpactAssessment = {
  cycloneName: string;
  eventId: string;
  hitsUserLocation: boolean;
  nearestDistanceToUserKm: number | null;
  nearbyCities: NearbyCityImpact[];
  inPhilippinesRegion: boolean;
};

export type TyphoonImpactResult = {
  userLat: number;
  userLng: number;
  trackProximityKm: number;
  assessments: CycloneImpactAssessment[];
  anyHitsUser: boolean;
  allNearbyCities: NearbyCityImpact[];
};

function minDistanceToTrack(
  point: { lat: number; lng: number },
  track: Array<{ lat: number; lng: number }>,
): number | null {
  if (track.length === 0) return null;
  return Math.min(...track.map((tp) => haversineKm(point, tp)));
}

function findNearbyCities(
  track: Array<{ lat: number; lng: number }>,
  cities: PhMajorCity[],
  maxKm: number,
): NearbyCityImpact[] {
  const hits: NearbyCityImpact[] = [];
  for (const city of cities) {
    const distanceToTrackKm = minDistanceToTrack(city, track);
    if (distanceToTrackKm !== null && distanceToTrackKm <= maxKm) {
      hits.push({
        name: city.name,
        region: city.region,
        distanceToTrackKm: Number(distanceToTrackKm.toFixed(1)),
      });
    }
  }
  return hits.sort((a, b) => a.distanceToTrackKm - b.distanceToTrackKm);
}

export function assessTyphoonImpact(
  cyclones: ActiveCyclone[],
  userLat: number,
  userLng: number,
  trackProximityKm = DEFAULT_TRACK_PROXIMITY_KM,
): TyphoonImpactResult {
  const userPoint = { lat: userLat, lng: userLng };
  const assessments: CycloneImpactAssessment[] = cyclones.map((cyclone) => {
    const nearestDistanceToUserKm = minDistanceToTrack(userPoint, cyclone.trackPoints);
    const hitsUserLocation =
      nearestDistanceToUserKm !== null && nearestDistanceToUserKm <= USER_DIRECT_HIT_KM;
    const nearbyCities = findNearbyCities(cyclone.trackPoints, PH_MAJOR_CITIES, trackProximityKm);

    return {
      cycloneName: cyclone.name,
      eventId: cyclone.eventId,
      hitsUserLocation,
      nearestDistanceToUserKm:
        nearestDistanceToUserKm !== null ? Number(nearestDistanceToUserKm.toFixed(1)) : null,
      nearbyCities,
      inPhilippinesRegion: cyclone.inPhilippinesRegion,
    };
  });

  const cityMap = new Map<string, NearbyCityImpact>();
  for (const assessment of assessments) {
    for (const city of assessment.nearbyCities) {
      const existing = cityMap.get(city.name);
      if (!existing || city.distanceToTrackKm < existing.distanceToTrackKm) {
        cityMap.set(city.name, city);
      }
    }
  }

  return {
    userLat,
    userLng,
    trackProximityKm,
    assessments,
    anyHitsUser: assessments.some((a) => a.hitsUserLocation),
    allNearbyCities: [...cityMap.values()].sort(
      (a, b) => a.distanceToTrackKm - b.distanceToTrackKm,
    ),
  };
}
