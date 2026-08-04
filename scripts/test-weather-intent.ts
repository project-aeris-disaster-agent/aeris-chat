#!/usr/bin/env tsx
/**
 * Smoke test for weather-intent heuristics.
 *
 * Run with: npm run smoke:weather-intent
 */

import { detectIncidentIntent } from "../lib/incidents/intent";
import { detectWeatherIntent, detectWeatherIntentWithHistory } from "../lib/weather/intent";
import { detectPlaceMention, detectPlaceMentionWithHistory } from "../lib/weather/place-mention";

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
check("detects Naga by name", detectPlaceMention("will it rain in naga tomorrow?")?.name === "Naga");
check("no false place on plain question", detectPlaceMention("will it rain today?") === null);
check(
  "no substring false positive (Cebuano)",
  detectPlaceMention("can you speak Cebuano?") === null,
);

console.log("\n[ detectPlaceMentionWithHistory ]");
const nagaHistory = ["will it rain in naga tomorrow?"];
const yesPlace = detectPlaceMentionWithHistory("yes", nagaHistory);
check("short yes inherits Naga", yesPlace?.name === "Naga", JSON.stringify(yesPlace));
check(
  "long topic change does not inherit place",
  detectPlaceMentionWithHistory(
    "anyway can you help me write a long essay about something unrelated to weather please?",
    nagaHistory,
  ) === null,
);
check(
  "follow-up without place history stays null",
  detectPlaceMentionWithHistory("yes", ["hello aeris"]) === null,
);

console.log("\n[ incident vs weather separation ]");
const incidentMessage = "binabaha kami sa Marikina";
check(
  "incident intent still matches active flooding",
  detectIncidentIntent(incidentMessage).match,
);
// Design note: only an URGENT incident suppresses weather enrichment. A
// non-urgent flood report keeps its forecast — whether more rain is coming is
// exactly what that user needs in order to decide whether to leave. Hotlines
// are injected separately either way (app/api/chat/route.ts).
check(
  "non-urgent incident still gets weather data",
  detectWeatherIntent(incidentMessage).match,
  JSON.stringify(detectWeatherIntent(incidentMessage)),
);
check(
  "urgent incident skips weather enrichment for speed",
  !detectWeatherIntent("tulong! naipit kami sa bubong, tumataas ang tubig").match,
);

console.log("\n[ soft-urgency must not strip grounding (G-1) ]");

// "help me" is politeness far more often than distress. It must not flip a
// preparedness question into an SOS and strip its live data.
const politeHelp = "Can you help me understand the typhoon signals for tomorrow?";
check(
  "polite 'can you help me' is not an incident",
  !detectIncidentIntent(politeHelp).match,
  JSON.stringify(detectIncidentIntent(politeHelp)),
);
check(
  "polite 'can you help me' keeps weather intent",
  detectWeatherIntent(politeHelp).match,
  JSON.stringify(detectWeatherIntent(politeHelp)),
);
check(
  "'help me understand' phrasing is not urgent",
  !detectIncidentIntent("help me understand the rainfall forecast").urgent,
);
check(
  "Tagalog polite request is not urgent",
  !detectIncidentIntent("pwede mo ba akong tulungan intindihin ang bagyo?").urgent,
);

// The safety net: a real emergency phrased politely still fires on the hard
// keyword, so leniency above never costs us a genuine SOS.
check(
  "polite phrasing with real distress is STILL urgent",
  detectIncidentIntent("can you help me, I'm trapped on the roof").urgent,
  JSON.stringify(detectIncidentIntent("can you help me, I'm trapped on the roof")),
);
check(
  "bare 'tulong!' cry is still urgent",
  detectIncidentIntent("tulong! binabaha kami").urgent,
);
check(
  "'help us' in distress is still urgent",
  detectIncidentIntent("help us the water is rising fast").urgent,
);

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
