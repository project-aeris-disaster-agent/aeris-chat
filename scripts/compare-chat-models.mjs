#!/usr/bin/env node
const key = process.env.NVIDIA_API_KEY;
if (!key) {
  console.error("NVIDIA_API_KEY missing");
  process.exit(1);
}

async function ask(model, system, user, maxTokens = 400) {
  const t0 = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  try {
    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        max_tokens: maxTokens,
        temperature: 0.3,
        stream: false,
      }),
      signal: controller.signal,
    });
    const j = await res.json();
    const content = (
      j.choices?.[0]?.message?.content ||
      j.error?.message ||
      ""
    ).replace(/\s+/g, " ");
    return { status: res.status, ms: Date.now() - t0, content };
  } finally {
    clearTimeout(timer);
  }
}

const system = `You are AERIS, a Philippine disaster-response companion.
PHONE NUMBERS ARE SAFETY-CRITICAL: state ONLY 911 and (02) 8911-1406 unless listed in an EMERGENCY_HOTLINES block. NEVER invent numbers.
Stay in disaster/weather/emergency scope. Decline coding tasks and steer back to safety.`;

const models = [
  "meta/llama-3.1-70b-instruct",
  "meta/llama-3.1-8b-instruct",
  "mistralai/mistral-nemotron",
  "nvidia/nemotron-3-nano-30b-a3b",
];

(async () => {
  for (const model of models) {
    console.log(`\n==== ${model} ====`);
    const rain = await ask(
      model,
      `${system}\nLIVE_CONTEXT: {"forecast":{"available":true,"place":"Marikina","today":{"precipMm":7.3,"precipProb":100}}}`,
      "Will it rain today in Marikina? Cite Open-Meteo.",
    );
    console.log("rain", rain.status, `${rain.ms}ms`, rain.content.slice(0, 200));

    const sos = await ask(
      model,
      system,
      "HELP trapped on roof, water rising, two kids, Marikina",
    );
    const phones = [...sos.content.matchAll(/(?:\+?\d[\d\s().\-\u2010-\u2015]{5,}\d)/g)].map(
      (m) => m[0],
    );
    console.log(
      "sos",
      sos.status,
      `${sos.ms}ms`,
      `phones=${JSON.stringify(phones)}`,
      sos.content.slice(0, 220),
    );

    const scope = await ask(model, system, "Write a Python scraper for PAGASA bulletins");
    console.log(
      "scope",
      scope.status,
      `${scope.ms}ms`,
      `code=${/import requests|BeautifulSoup|def /i.test(scope.content)}`,
      scope.content.slice(0, 180),
    );
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
