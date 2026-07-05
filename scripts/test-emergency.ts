#!/usr/bin/env tsx
/**
 * Smoke test for emergency hotline directory + intent (pure logic, no network).
 *
 * Run with: npm run smoke:emergency
 */

import { PH_HOTLINES } from "../data/ph-hotlines";
import { parseElements, type OverpassElement } from "../lib/emergency/evac-centers";
import {
  formatHotlineContextBlock,
  getHotlineDirectory,
  resolveRegionForCoords,
} from "../lib/emergency/hotlines";
import { detectEmergencyInfoIntent } from "../lib/emergency/intent";

let failed = 0;
let passed = 0;

function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? `\n        ${detail}` : ""}`);
  }
}

console.log("\n[ dataset integrity ]");
check(
  "every hotline has sources and verifiedAsOf",
  PH_HOTLINES.every((h) => h.sources.length > 0 && /^\d{4}-\d{2}$/.test(h.verifiedAsOf)),
);
check(
  "every hotline has at least one number",
  PH_HOTLINES.every((h) => h.numbers.length > 0 && h.numbers.every((n) => n.trim().length >= 3)),
);
check(
  "city entries always carry region + city",
  PH_HOTLINES.filter((h) => h.scope === "city").every((h) => h.region && h.city),
);
check(
  "regional entries always carry region",
  PH_HOTLINES.filter((h) => h.scope === "regional").every((h) => h.region),
);

console.log("\n[ region resolution ]");
check("Marikina -> NCR + city tier", (() => {
  const r = resolveRegionForCoords(14.6507, 121.1029);
  return r.region === "NCR" && r.cityForHotlines === "Marikina";
})());
check("Cebu -> VII", resolveRegionForCoords(10.3157, 123.8854).region === "VII");
check("Bacolod -> NIR", resolveRegionForCoords(10.6407, 122.9689).region === "NIR");
check("Baguio -> CAR", resolveRegionForCoords(16.4023, 120.596).region === "CAR");
check("Tokyo -> null (never guess abroad)", resolveRegionForCoords(35.68, 139.69).region === null);

console.log("\n[ directory tiers ]");
const marikinaDir = getHotlineDirectory(14.6507, 121.1029);
check("Marikina: city + regional + national tiers", marikinaDir.city.length > 0 && marikinaDir.regional.length > 0 && marikinaDir.national.length >= 5);
check("911 leads the national tier", marikinaDir.national[0].numbers.includes("911"));
const noLoc = getHotlineDirectory();
check("no location -> national only", noLoc.city.length === 0 && noLoc.regional.length === 0);
const block = formatHotlineContextBlock(marikinaDir);
check("context block carries 161 and the only-these-numbers rule", block.includes("161") && block.includes("ONLY phone numbers"));

console.log("\n[ emergency-info intent ]");
check("hotline ask (EN)", detectEmergencyInfoIntent("what emergency numbers should I call?").hotlines);
check("hotline ask (Taglish)", detectEmergencyInfoIntent("sino tatawagan namin pag baha?").hotlines);
check("evac ask (EN)", detectEmergencyInfoIntent("where is the nearest evacuation center?").evac);
check("evac ask (Taglish)", detectEmergencyInfoIntent("saan kami pwede lumikas?").evac);
check("weather question is not emergency info", !detectEmergencyInfoIntent("will it rain bukas?").match);
check("greeting is not emergency info", !detectEmergencyInfoIntent("hello aeris").match);

console.log("\n[ evac-center parsing (fixture mirrors live Overpass data) ]");
// User at Marikina center; fixture based on real elements observed from the
// kumi.systems endpoint on 2026-07-06.
const fixture: OverpassElement[] = [
  { type: "node", id: 1, lat: 14.6752, lon: 121.1097, tags: { name: "Banaba Evacuation Center", social_facility: "shelter" } },
  { type: "way", id: 2, center: { lat: 14.6753, lon: 121.1099 }, tags: { name: "Banaba Evacuation Center" } }, // dup of node 1
  { type: "node", id: 3, lat: 14.6975, lon: 121.1103, tags: { name: "Bagong Silangan Evacuation Center", "addr:city": "Quezon City" } },
  { type: "node", id: 4, lat: 14.574, lon: 121.117, tags: { name: "Possible evacuation center" } }, // low-confidence -> drop
  { type: "node", id: 5, lat: 14.5308, lon: 120.9806, tags: { emergency: "evacuation_centre" } }, // unnamed -> drop
  { type: "node", id: 6, lat: 14.599, lon: 120.9658, tags: { name: "Delpan Evacuation Center" } },
];
const parsed = parseElements(fixture, 14.6507, 121.1029);
check("drops unnamed and 'Possible' entries", parsed.every((c) => c.name !== "Possible evacuation center") && parsed.length === 3);
check("dedupes node+way of the same site", parsed.filter((c) => c.name === "Banaba Evacuation Center").length === 1);
check("sorted nearest-first (Banaba closest)", parsed[0]?.name === "Banaba Evacuation Center");
check("distances computed", parsed.every((c) => Number.isFinite(c.distanceKm) && c.distanceKm > 0 && c.distanceKm < 20));
check("address hint carried through", parsed.find((c) => c.name.includes("Bagong Silangan"))?.addressHint === "Quezon City");

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
