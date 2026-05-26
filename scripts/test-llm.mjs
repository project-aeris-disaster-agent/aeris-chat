#!/usr/bin/env node
/**
 * AERIS CHAT LLM smoke test.
 *
 * Hits GET /api/llm/chat for health, then POST /api/llm/chat for a
 * deterministic round-trip against the configured NVIDIA backend.
 *
 * Usage:
 *   node scripts/test-llm.mjs                            # uses LLM_TEST_BASE_URL or http://localhost:3000
 *   LLM_TEST_BASE_URL=https://chat.example.com \
 *   LLM_API_KEY=sk-... \
 *   node scripts/test-llm.mjs
 *
 * Exit codes:
 *   0 on success, 1 on any failure. Intended for CI / preflight.
 */

import process from "node:process";

const baseUrl = (
  process.env.LLM_TEST_BASE_URL ||
  process.env.AERIS_CHAT_API_BASE_URL ||
  "http://localhost:3000"
).replace(/\/+$/, "");

const apiKey = (process.env.LLM_API_KEY || process.env.AERIS_CHAT_API_KEY || "").trim();

const healthUrl = `${baseUrl}/api/llm/chat`;
const chatUrl = `${baseUrl}/api/llm/chat`;

const timeoutMs = Number(process.env.LLM_TEST_TIMEOUT_MS || 30_000);

function fmt(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function checkHealth() {
  process.stdout.write(`[health] GET ${healthUrl}\n`);
  const res = await fetchWithTimeout(healthUrl, { method: "GET" });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`Health check failed (${res.status}): ${fmt(data)}`);
  }
  if (!data?.ok) {
    throw new Error(`Health check reports not ok: ${fmt(data)}`);
  }
  process.stdout.write(`[health] ok provider=${data.provider ?? "?"} model=${data.model ?? "?"}\n`);
  return data;
}

async function checkChat() {
  process.stdout.write(`[chat] POST ${chatUrl}\n`);
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const body = JSON.stringify({
    messages: [
      {
        role: "system",
        content:
          "You are a deterministic smoke-test responder. Reply with exactly the single word: pong",
      },
      { role: "user", content: "ping" },
    ],
  });

  const res = await fetchWithTimeout(chatUrl, { method: "POST", headers, body });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`Chat call failed (${res.status}): ${fmt(data)}`);
  }
  const message = typeof data?.message === "string" ? data.message : "";
  if (!message.trim()) {
    throw new Error(`Chat returned empty message: ${fmt(data)}`);
  }
  process.stdout.write(`[chat] ok reply=${JSON.stringify(message.slice(0, 200))}\n`);
  return data;
}

async function main() {
  process.stdout.write(`[smoke] AERIS CHAT LLM smoke test\n`);
  process.stdout.write(`[smoke] baseUrl=${baseUrl} timeoutMs=${timeoutMs} authHeader=${apiKey ? "yes" : "no"}\n`);
  await checkHealth();
  await checkChat();
  process.stdout.write(`[smoke] PASS\n`);
}

main().catch((err) => {
  process.stderr.write(`[smoke] FAIL: ${err?.message ?? err}\n`);
  process.exit(1);
});
