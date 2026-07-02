/**
 * Server-side, zero-friction abuse heuristics for incident reports.
 *
 * The design goal: SOS / urgent reports are NEVER blocked or challenged. These
 * helpers only decide (a) whether a report counts as urgent (and is therefore
 * exempt from throttling) and (b) whether a NON-urgent report looks low quality
 * and should be routed to moderation instead of published immediately.
 */

import { detectIncidentIntent } from "@/lib/incidents/intent";

// Rough Philippine bounding box (with generous margins for EEZ / outlying isles).
const PH_BOUNDS = { minLat: 4.0, maxLat: 21.5, minLng: 116.0, maxLng: 127.5 };

/** SOS category or urgent language means "accept immediately, no throttle". */
export function isUrgentReport(category: string, description: string): boolean {
  if (category?.toUpperCase() === "SOS") return true;
  return detectIncidentIntent(description).urgent;
}

export function isInsidePhilippines(position: [number, number]): boolean {
  const [lng, lat] = position;
  return (
    lat >= PH_BOUNDS.minLat &&
    lat <= PH_BOUNDS.maxLat &&
    lng >= PH_BOUNDS.minLng &&
    lng <= PH_BOUNDS.maxLng
  );
}

export type QualityAssessment = {
  lowQuality: boolean;
  reasons: string[];
};

/**
 * Lightweight quality signal for NON-urgent reports only. Never call this to
 * gate an urgent/SOS report.
 */
export function assessReportQuality(input: {
  description: string;
  position: [number, number];
}): QualityAssessment {
  const reasons: string[] = [];
  const desc = input.description.trim();

  if (desc.length < 10) reasons.push("description_too_short");

  // Very low character diversity (e.g. "aaaaaaa", "!!!!!!") reads as junk.
  const uniqueChars = new Set(desc.toLowerCase().replace(/\s/g, "")).size;
  if (desc.length >= 10 && uniqueChars <= 3) reasons.push("low_char_diversity");

  if (!isInsidePhilippines(input.position)) reasons.push("outside_ph_bounds");

  return { lowQuality: reasons.length > 0, reasons };
}
