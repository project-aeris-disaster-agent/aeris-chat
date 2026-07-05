#!/usr/bin/env tsx
/**
 * Smoke test for weather-intent heuristics.
 *
 * Run with: npm run smoke:weather-intent
 */

import { detectIncidentIntent } from "../lib/incidents/intent";
import { detectWeatherIntent, detectWeatherIntentWithHistory } from "../lib/weather/intent";
import { detectPlaceMention } from "../lib/weather/place-mention";

type Case = {
  name: string;
  input: string;
  expect: (actual: ReturnType<typeof detectWeatherIntent>) => boolean;
};

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

console.log("\n[ detectWeatherIntent ]");

const cases: Case[] = [
  {
    name: "rain tomorrow is forecast intent",
    input: "will it rain tomorrow?",
    expect: (r) => r.match && r.kind === "forecast",
  },
  {
    name: "flood tomorrow is forecast intent",
    input: "will it flood tomorrow?",
    expect: (r) => r.match && r.kind === "forecast",
  },
  {
    name: "Taglish ulan bukas is forecast intent",
    input: "uulan ba bukas dito?",
    expect: (r) => r.match && r.kind === "forecast",
  },
  {
    name: "typhoon this week is typhoon intent",
    input: "is there a typhoon incoming this week?",
    expect: (r) => r.match && r.kind === "typhoon",
  },
  {
    name: "Taglish bagyo is typhoon intent",
    input: "may bagyo ba ngayong linggo?",
    expect: (r) => r.match && r.kind === "typhoon",
  },
  {
    name: "rain and typhoon is both",
    input: "will the typhoon bring heavy rain this week?",
    expect: (r) => r.match && r.kind === "both",
  },
  {
    name: "active incident flood is not weather intent",
    input: "my house is flooding and my kids are stuck on the roof",
    expect: (r) => !r.match,
  },
  {
    name: "Filipino active baha is not weather intent",
    input: "tulong! binabaha kami sa Marikina, naipit ang aming pamilya",
    expect: (r) => !r.match,
  },
  {
    name: "greeting is not weather intent",
    input: "hello aeris",
    expect: (r) => !r.match,
  },
];

for (const testCase of cases) {
  const result = detectWeatherIntent(testCase.input);
  check(testCase.name, testCase.expect(result), JSON.stringify(result));
}

console.log("\n[ detectWeatherIntentWithHistory ]");

const rainHistory = ["will it rain today?"];
const followUp = detectWeatherIntentWithHistory("and in Baguio?", rainHistory);
check(
  "short follow-up inherits forecast intent",
  followUp.match && followUp.kind === "forecast" && followUp.signals.includes("follow-up:forecast"),
  JSON.stringify(followUp),
);
check(
  "long topic change does not inherit",
  !detectWeatherIntentWithHistory(
    "can you explain how I should prepare an emergency go-bag for my family of five including documents and medicine",
    rainHistory,
  ).match,
);
check(
  "follow-up without weather history stays unmatched",
  !detectWeatherIntentWithHistory("and in Baguio?", ["hello aeris"]).match,
);
check(
  "incident phrasing never inherits weather intent",
  !detectWeatherIntentWithHistory("tulong! binabaha kami", rainHistory).match,
);

console.log("\n[ detectPlaceMention ]");

const cebu = detectPlaceMention("will it rain in Cebu tomorrow?");
check("detects Cebu alias", cebu?.name === "Cebu City", JSON.stringify(cebu));
const cebuCity = detectPlaceMention("typhoon signal sa Cebu City?");
check("longest alias wins for Cebu City", cebuCity?.name === "Cebu City");
const qc = detectPlaceMention("baha ba sa QC?");
check("detects QC alias", qc?.name === "Quezon City", JSON.stringify(qc));
check("no false place on plain question", detectPlaceMention("will it rain today?") === null);
check(
  "no substring false positive (Cebuano)",
  detectPlaceMention("can you speak Cebuano?") === null,
);

console.log("\n[ incident vs weather separation ]");
const incidentMessage = "binabaha kami sa Marikina";
check(
  "incident intent still matches active flooding",
  detectIncidentIntent(incidentMessage).match,
);
check(
  "weather intent skips active incident phrasing",
  !detectWeatherIntent(incidentMessage).match,
);

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
