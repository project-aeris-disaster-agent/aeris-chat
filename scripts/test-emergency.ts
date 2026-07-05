#!/usr/bin/env tsx
/**
 * Smoke test for emergency hotline directory + intent (pure logic, no network).
 *
 * Run with: npm run smoke:emergency
 */

import { emergencyHotlines, nagaQuickAccessHotlines } from "../data/emergency-hotlines";
import { parseElements, type OverpassElement } from "../lib/emergency/evac-centers";
import {
  formatHotlineContextBlock,
  getHotlineDirectory,
  getHotlineLocale,
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

console.log("\n[ dataset integrity (consolidated data/emergency-hotlines.ts) ]");
check(
  "every entry has a dialable number",
  emergencyHotlines.every((h) => Boolean(h.hotline) || h.trunkDirectLine.length > 0),
);
const verified = emergencyHotlines.filter((h) => h.verifiedAsOf);
check(
  `verified entries (${verified.length}) all carry sources + YYYY-MM stamp`,
  verified.length >= 20 &&
    verified.every((h) => (h.sources?.length ?? 0) > 0 && /^\d{4}-\d{2}$/.test(h.verifiedAsOf!)),
);
check(
  "OCD regional coverage spans 15 regions",
  emergencyHotlines.filter((h) => h.agency.startsWith("Office of Civil Defense")).length === 15,
);
check(
  "no dead pre-migration (02) 7-digit numbers among verified entries",
  verified.every((h) =>
    [h.hotline, ...h.trunkDirectLine]
      .filter((n): n is string => Boolean(n))
      .every((n) => !/\(0?2\)\s?\d{3}-?\d{4}(?!\d)/.test(n.replace(/\s+/g, " "))),
  ),
);
check(
  "PNP no longer lists the Red Cross trunkline",
  !emergencyHotlines.some(
    (h) => h.agency === "Philippine National Police" && h.trunkDirectLine.includes("(02) 8790-2300"),
  ),
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
check("911 present in national tier", marikinaDir.national.some((h) => h.hotline === "911"));
check("MMDA in NCR regional tier", marikinaDir.regional.some((h) => h.agency.includes("Metropolitan Manila")));
const noLoc = getHotlineDirectory();
check("no location -> national only", noLoc.city.length === 0 && noLoc.regional.length === 0);
const block = formatHotlineContextBlock(marikinaDir);
check("context block carries 161 and the only-these-numbers rule", block.includes("161") && block.includes("ONLY phone numbers"));
const nir = getHotlineDirectory(10.6407, 122.9689);
check("NIR honest: no guessed regional line", nir.regional.length === 0 && nir.advisory.length > 10);
const naga = getHotlineDirectory(13.6192, 123.1814);
check("Naga: NAGA CITY tier + OCD R V regional", naga.city.length >= 5 && naga.regional.some((h) => h.area === "R V"));

console.log("\n[ modal locale (location-aware quick access) ]");
const nagaLocale = getHotlineLocale(13.6192, 123.1814);
check("Naga locale preserves curated quick-dial set", nagaLocale.quickAccess === nagaQuickAccessHotlines && nagaLocale.defaultFilter === "naga-city");
const mkLocale = getHotlineLocale(14.6507, 121.1029);
check("Marikina locale: city tile + MMDA + Red Cross 143", mkLocale.quickAccess.some((t) => t.shortLabel === "Marikina") && mkLocale.quickAccess.some((t) => t.shortLabel === "MMDA") && mkLocale.quickAccess.some((t) => t.number === "143"));
check("Marikina defaults to manila-hq tab", mkLocale.defaultFilter === "manila-hq");
const cebuLocale = getHotlineLocale(10.3157, 123.8854);
check("Cebu locale: OCD Region VII tile + visayas tab", cebuLocale.quickAccess.some((t) => t.label.includes("Region VII")) && cebuLocale.defaultFilter === "visayas");
const noLocale = getHotlineLocale();
check("no location -> national tiles still offered", noLocale.quickAccess.length >= 2);

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
