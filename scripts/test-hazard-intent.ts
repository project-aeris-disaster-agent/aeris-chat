#!/usr/bin/env tsx
/**
 * Smoke test for hazard-intent detection (earthquake / volcano / landslide /
 * general advisory questions). These previously matched no detector at all and
 * reached the model ungrounded.
 *
 * Run with: npm run smoke:hazard-intent
 */

import { detectHazardIntent } from "../lib/hazards/intent";
import { detectWeatherIntent } from "../lib/weather/intent";

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

console.log("\n[ seismic ]");
for (const q of [
  "May lindol ba kanina sa Metro Manila?",
  "Was that an earthquake?",
  "what was the magnitude of the quake in Davao?",
  "may aftershock pa ba?",
  "is there a tsunami warning?",
]) {
  const r = detectHazardIntent(q);
  check(`seismic: "${q}"`, r.match && r.kinds.includes("seismic"), JSON.stringify(r));
}

console.log("\n[ volcanic ]");
for (const q of [
  "Is Taal Volcano erupting right now?",
  "anong alert level ng Mayon?",
  "may ashfall ba dito?",
  "kumakalat ba ang lahar sa Kanlaon?",
]) {
  const r = detectHazardIntent(q);
  check(`volcanic: "${q}"`, r.match && r.kinds.includes("volcanic"), JSON.stringify(r));
}

console.log("\n[ landslide ]");
for (const q of ["Is there landslide risk in my area?", "may pagguho ba ng lupa sa Baguio?"]) {
  const r = detectHazardIntent(q);
  check(`landslide: "${q}"`, r.match && r.kinds.includes("landslide"), JSON.stringify(r));
}

console.log("\n[ general advisory ]");
for (const q of [
  "What is the latest news about the weather situation?",
  "any advisory today?",
  "anong balita ngayon?",
  "what's happening in Manila?",
]) {
  const r = detectHazardIntent(q);
  check(`general: "${q}"`, r.match && r.kinds.includes("general"), JSON.stringify(r));
}

console.log("\n[ must NOT match — ordinary chat ]");
for (const q of [
  "hello aeris",
  "will it rain today?",
  "salamat po",
  "what should I put in a go bag?",
  "can you speak Tagalog?",
]) {
  const r = detectHazardIntent(q);
  check(`no match: "${q}"`, !r.match, JSON.stringify(r));
}

console.log("\n[ hazard and weather intents coexist ]");
// A storm question that also mentions landslides should still get weather data;
// the two detectors are independent and both context blocks may be injected.
const combo = "will the rain cause landslides tomorrow?";
check(
  "combo triggers hazard intent",
  detectHazardIntent(combo).match,
  JSON.stringify(detectHazardIntent(combo)),
);
check(
  "combo still triggers weather intent",
  detectWeatherIntent(combo).match,
  JSON.stringify(detectWeatherIntent(combo)),
);

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
