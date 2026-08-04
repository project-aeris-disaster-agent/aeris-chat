#!/usr/bin/env tsx
/**
 * Smoke test for the TCWS signal-claim guard.
 *
 * Regression target: llama-3.1-8b told a Marikina user "You are in Marikina
 * City, which is currently under Signal No. 2" when the only source was a
 * headline saying Signal No. 2 covered "6 Luzon areas" — never naming which.
 *
 * Run with: npm run smoke:signal-claims
 */

import { sanitizeSignalClaims, stripInternalIdentifiers } from "../lib/guardrails/signal-claims";

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

// The real context from the production failure: signal mentioned, city absent.
const NEWS_CTX = [
  `HAZARD_NEWS (JSON):\n${JSON.stringify({
    items: [
      { title: "Signal No. 2 raised over 6 Luzon areas as Maymay intensifies into storm —Pagasa", source: "Manila Times" },
      { title: "Heavy rainfall forecast over areas in Luzon due to Maymay – Pagasa", source: "Inquirer.net" },
    ],
  })}`,
];

console.log("\n[ blocks the production failure ]");
const actual =
  "**Typhoon Signal Status:** You are in Marikina City, which is currently under Signal No. 2 due to Tropical Storm Maymay.";
const r1 = sanitizeSignalClaims(actual, NEWS_CTX, "Marikina City");
check("rewrites 'you are ... under Signal No. 2'", r1.modified, JSON.stringify(r1.removed));
check("no signal level survives in output", !/signal\s*(no\.?|number)?\s*2/i.test(r1.text), r1.text);
check("points the user at PAGASA instead", /PAGASA/i.test(r1.text), r1.text);

console.log("\n[ personalisation variants ]");
for (const [name, text] of [
  ["your area", "Your area is under Signal No. 3 right now."],
  ["you're", "You're currently under signal number 1."],
  ["TCWS form", "TCWS #2 is in effect for your location."],
  ["city named", "Marikina City is under Signal No. 4."],
  ["Tagalog kayo", "Nasa Signal No. 2 kayo ngayon dahil sa bagyo."],
] as Array<[string, string]>) {
  const r = sanitizeSignalClaims(text, NEWS_CTX, "Marikina City");
  check(`catches: ${name}`, r.modified && !/signal\s*(no\.?|number|#)?\s*[1-5]/i.test(r.text), r.text);
}

console.log("\n[ negative claims are equally unverifiable ]");
for (const [name, text] of [
  ["no signal (EN)", "There is no wind signal in effect for your area."],
  ["not under", "You are not under any signal today."],
  ["walang (TL)", "Walang signal sa inyong lugar ngayon."],
] as Array<[string, string]>) {
  const r = sanitizeSignalClaims(text, NEWS_CTX, "Marikina City");
  check(`catches: ${name}`, r.modified, r.text);
}

console.log("\n[ must NOT over-block ]");
const general = "Signal No. 2 has been raised over 6 areas in Luzon, according to PAGASA via news reports.";
const rGen = sanitizeSignalClaims(general, NEWS_CTX, "Marikina City");
check("general reporting is preserved", !rGen.modified, rGen.text);

const noSignal = "Tomorrow will be rainy with a high of 27.2C. Stay hydrated and bring an umbrella.";
check("unrelated text untouched", !sanitizeSignalClaims(noSignal, NEWS_CTX, "Marikina City").modified);

const sos = "Call 911 immediately. NDRRMC hotline: (02) 8911-1406. Share your exact location with rescuers.";
const rSos = sanitizeSignalClaims(sos, [], "Marikina City");
check("SOS guidance untouched", !rSos.modified && rSos.text === sos);

console.log("\n[ grounded claims are allowed through ]");
// If the context DOES pair the location with a signal, the model had a basis.
const groundedCtx = [
  `HAZARD_NEWS (JSON):\n${JSON.stringify({
    items: [{ title: "Signal No. 2 raised over Marikina City, Quezon City and Pasig —Pagasa", source: "Manila Times" }],
  })}`,
];
const rGrounded = sanitizeSignalClaims(
  "You are in Marikina City, which is under Signal No. 2.",
  groundedCtx,
  "Marikina City",
);
check("allows a claim the context actually supports", !rGrounded.modified, rGrounded.text);

console.log("\n[ internal identifier scrub ]");
const leak = "According to LIVE_CONTEXT.cyclones, one tropical depression is in PAR.";
const rLeak = stripInternalIdentifiers(leak);
check("rewrites LIVE_CONTEXT.cyclones", rLeak.modified && !/LIVE_CONTEXT/.test(rLeak.text), rLeak.text);
check("reads naturally", /the latest data I have/i.test(rLeak.text), rLeak.text);
check(
  "HAZARD_NEWS rewritten",
  stripInternalIdentifiers("HAZARD_NEWS reports flooding.").text.includes("recent news reports"),
);
check("clean text untouched", !stripInternalIdentifiers("It will rain tomorrow.").modified);

console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
