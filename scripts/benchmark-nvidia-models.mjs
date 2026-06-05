#!/usr/bin/env node
/**
 * Benchmark NVIDIA models for AGENT AERIS (quality + latency).
 *
 * Usage (from AERIS CHAT root):
 *   node --env-file=.env scripts/benchmark-nvidia-models.mjs
 *
 * Writes scripts/benchmark-results.json and prints a ranked table.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.join(__dirname, "benchmark-results.json");

const NVIDIA_CHAT_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

const CANDIDATES = [
  "meta/llama-3.3-70b-instruct",
  "mistralai/mistral-medium-3.5-128b",
  "nvidia/llama-3.3-nemotron-super-49b-v1.5",
  "meta/llama-4-maverick-17b-128e-instruct",
  "nvidia/nemotron-3-nano-30b-a3b",
];

const PERSONA = `You are AGENT AERIS, the disaster-preparedness assistant embedded in the AERIS Typhoon Resilience Terminal — a dashboard used by operators, responders, and informed citizens in the Philippines.

SCOPE
- Philippine typhoons, floods, storm surge, landslides, severe rainfall, and related response logistics.

TONE
- Concise, operational, plain language. Prefer bullets over paragraphs.
- Never invent data. If the live context object does not contain a fact, say so explicitly.

CITATIONS
- Every factual claim drawn from live context MUST be tagged inline, e.g. [PAGASA Daily], [Open-Meteo forecast].

OUTPUT TEMPLATES — pick ONE based on the operator's intent:
1. Situation Brief — when the operator asks for a readout/briefing:
   ## Situation Brief
   - Storm: <name + classification or "none in PAR">
   - Signal/Risk: <wind signal level OR national verdict label>
   - Exposure: <selected location summary>
   - Top 3 Actions: 1) … 2) … 3) …

DISCLAIMER
- Always end with: "Not an official PAGASA product. Follow PAGASA, NDRRMC, and your LGU for evacuation orders."`;

const LIVE_CONTEXT = {
  generatedAt: new Date().toISOString(),
  regionLock: "Philippines",
  national: {
    verdictLabel: "Elevated rainfall risk",
    verdictTone: "warn",
    severityScore: 2,
    briefFacts: [
      "No named typhoon inside PAR per current GDACS feed [GDACS TC feed]",
      "NCR forecast: heavy showers possible next 24h [Open-Meteo forecast]",
    ],
    typhoonAlerts: [],
    worstRegionalAlert: { label: "NCR", level: 2, score: 55, tone: "warn" },
    elevatedRivers: [{ name: "Marikina River", level: "normal", current: 12.4 }],
  },
  selectedLocation: {
    name: "Metro Manila",
    breadcrumb: "NCR > Metro Manila",
    type: "region",
    nearestRegion: { code: "NCR", name: "Metro Manila", km: 0 },
  },
};

const USER_PROMPT =
  "Give me a Situation Brief for Metro Manila based on the live context.";

const TIMEOUT_MS = Number(process.env.BENCHMARK_TIMEOUT_MS ?? "60000");
const MAX_TOKENS = Number(process.env.BENCHMARK_MAX_TOKENS ?? "1024");

function scoreResponse(content, latencyMs) {
  const lower = content.toLowerCase();
  let score = 0;
  const checks = {
    hasBrief: /##\s*situation brief/i.test(content),
    hasDisclaimer: /not an official pagasa product/i.test(lower),
    hasCitation:
      /\[(pagasa|open-meteo|gdacs)/i.test(content) ||
      /\[PAGASA/i.test(content),
    under60s: latencyMs < 60_000,
    under25s: latencyMs < 25_000,
    reasonableLength: content.length > 120 && content.length < 4500,
  };
  if (checks.hasBrief) score += 30;
  if (checks.hasDisclaimer) score += 25;
  if (checks.hasCitation) score += 20;
  if (checks.reasonableLength) score += 10;
  if (checks.under60s) score += 10;
  if (checks.under25s) score += 5;
  return { score, checks };
}

async function callModel(apiKey, model) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = performance.now();

  const body = {
    model,
    messages: [
      { role: "system", content: PERSONA },
      {
        role: "system",
        content: `LIVE_CONTEXT (JSON):\n${JSON.stringify(LIVE_CONTEXT)}`,
      },
      { role: "user", content: USER_PROMPT },
    ],
    max_tokens: MAX_TOKENS,
    temperature: 0.5,
    stream: false,
  };

  try {
    const res = await fetch(NVIDIA_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const latencyMs = Math.round(performance.now() - started);
    const data = await res.json().catch(() => ({}));
    const content =
      typeof data?.choices?.[0]?.message?.content === "string"
        ? data.choices[0].message.content
        : "";

    if (!res.ok) {
      return {
        model,
        ok: false,
        latencyMs,
        status: res.status,
        error: data?.error?.message ?? `HTTP ${res.status}`,
        content: "",
        score: 0,
        checks: {},
      };
    }

    const { score, checks } = scoreResponse(content, latencyMs);
    return {
      model,
      ok: true,
      latencyMs,
      status: res.status,
      error: null,
      contentPreview: content.slice(0, 280).replace(/\s+/g, " "),
      wordCount: content.split(/\s+/).filter(Boolean).length,
      score,
      checks,
    };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - started);
    const isAbort = err?.name === "AbortError";
    return {
      model,
      ok: false,
      latencyMs,
      status: isAbort ? 504 : 0,
      error: isAbort ? `Timeout after ${TIMEOUT_MS}ms` : String(err?.message ?? err),
      content: "",
      score: 0,
      checks: {},
    };
  } finally {
    clearTimeout(timer);
  }
}

function pad(str, len) {
  const s = String(str);
  return s.length >= len ? s.slice(0, len) : s + " ".repeat(len - s.length);
}

async function main() {
  const apiKey = process.env.NVIDIA_API_KEY?.trim();
  if (!apiKey) {
    console.error("NVIDIA_API_KEY is required (use: node --env-file=.env ...)");
    process.exit(1);
  }

  console.log(`Benchmarking ${CANDIDATES.length} models (timeout ${TIMEOUT_MS}ms)...\n`);

  const results = [];
  for (const model of CANDIDATES) {
    process.stdout.write(`  ${model} ... `);
    const result = await callModel(apiKey, model);
    results.push(result);
    const status = result.ok
      ? `OK ${result.latencyMs}ms score=${result.score}`
      : `FAIL ${result.error}`;
    console.log(status);
  }

  const ranked = [...results].sort((a, b) => {
    if (a.ok !== b.ok) return a.ok ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    return a.latencyMs - b.latencyMs;
  });

  const winner = ranked.find((r) => r.ok) ?? null;

  const payload = {
    ranAt: new Date().toISOString(),
    timeoutMs: TIMEOUT_MS,
    maxTokens: MAX_TOKENS,
    winner: winner?.model ?? null,
    results: ranked,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2));

  console.log("\n| Model | Latency | Score | Brief | Disclaimer |");
  console.log("|-------|---------|-------|-------|------------|");
  for (const r of ranked) {
    const c = r.checks ?? {};
    console.log(
      `| ${r.model} | ${r.ok ? `${r.latencyMs}ms` : "FAIL"} | ${r.score} | ${c.hasBrief ? "Y" : "N"} | ${c.hasDisclaimer ? "Y" : "N"} |`,
    );
  }

  if (winner) {
    console.log(`\nRecommended: ${winner.model}`);
    console.log(`Results written to ${OUT_PATH}`);
  } else {
    console.error("\nNo model succeeded. Check NVIDIA_API_KEY and network.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
