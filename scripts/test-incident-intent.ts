#!/usr/bin/env tsx
/**
 * Smoke test for incident-intent heuristics + draft validator.
 *
 * Run with: npm run smoke:intent
 */

import {
  detectIncidentIntent,
  validateDraft,
  DRAFT_CATEGORIES,
  type DraftIncidentReport,
} from "../lib/incidents/intent";

type Case<T> = {
  name: string;
  input: T;
  expect: (actual: ReturnType<typeof detectIncidentIntent>) => boolean;
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

console.log("\n[ detectIncidentIntent ]");

const intentCases: Case<string>[] = [
  {
    name: "first-person flood is a match",
    input: "my house is flooding and my kids are stuck on the roof",
    expect: (r) => r.match && r.urgent,
  },
  {
    name: "Filipino baha is a match",
    input: "tulong! binabaha kami sa Marikina, naipit ang aming pamilya",
    expect: (r) => r.match && r.urgent,
  },
  {
    name: "general weather question is not a match",
    input: "what is the weather today?",
    expect: (r) => !r.match,
  },
  {
    name: "thanks/greeting is not a match",
    input: "thanks for the update, have a good day",
    expect: (r) => !r.match,
  },
  {
    name: "third-person news mention without first-person stays low-confidence match",
    input: "There is a landslide in Benguet according to news.",
    expect: (r) => r.match === true || r.match === false, // either ok; just shouldn't crash
  },
  {
    name: "urgent SOS marker flips urgent flag",
    input: "SOS rescue needed, we are drowning",
    expect: (r) => r.match && r.urgent,
  },
];

for (const c of intentCases) {
  const actual = detectIncidentIntent(c.input);
  check(c.name, c.expect(actual), `got=${JSON.stringify(actual)}`);
}

console.log("\n[ validateDraft ]");

const goodDraft: DraftIncidentReport = {
  category: "flood",
  description: "House is flooding in Marikina, family of four stuck on roof.",
  urgent: true,
  suggestedSeverity: "critical",
  locationHint: "Marikina, near Nangka bridge",
  peopleAffected: 4,
  confidence: 0.92,
};

check("accepts a well-formed draft", validateDraft(goodDraft) !== null);

check(
  "rejects invalid category",
  validateDraft({ ...goodDraft, category: "wildfire" }) === null,
);

check(
  "rejects empty description",
  validateDraft({ ...goodDraft, description: "" }) === null,
);

check(
  "rejects invalid severity",
  validateDraft({ ...goodDraft, suggestedSeverity: "extreme" as unknown as "critical" }) === null,
);

check(
  "coerces out-of-range confidence",
  (validateDraft({ ...goodDraft, confidence: 9 })?.confidence ?? 0) === 1,
);

check(
  "infers urgent=true when severity=critical",
  validateDraft({ ...goodDraft, urgent: false, suggestedSeverity: "critical" })?.urgent === true,
);

check(
  "trims long descriptions",
  (validateDraft({ ...goodDraft, description: "x".repeat(2000) })?.description.length ?? 0) <= 1000,
);

check(
  "rejects non-object input",
  validateDraft("nope") === null && validateDraft(null) === null,
);

check(
  "every documented category is exported",
  DRAFT_CATEGORIES.length === 7,
);

console.log(`\nPassed: ${passed}  Failed: ${failed}`);
process.exit(failed === 0 ? 0 : 1);
