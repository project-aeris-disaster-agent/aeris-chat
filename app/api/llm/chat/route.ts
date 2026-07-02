/**

 * /api/llm/chat - frozen agent contract. See docs/AGENT_CONTRACT.md.

 *

 * This route is the single HTTP seam between AERIS DASHBOARD (and any future

 * MCP / AI SDK / self-hosted-LLM client) and the underlying model. The shape

 * below is stable; consumers MUST NOT depend on undocumented fields.

 *

 *   GET  -> { ok: boolean, provider: string, model: string | null }

 *   POST -> 200 { message: string, content: string, provider: string, model: string }

 *           4xx/5xx { error: string }

 *

 * Auth: Authorization: Bearer <LLM_API_KEY> (required when LLM_API_KEY is set).

 */

export const dynamic = "force-dynamic";

export const runtime = "nodejs";

export const maxDuration = 120;



import { NextRequest, NextResponse } from "next/server";

import {

  authorizeLlmProxy,

  callNvidiaChatCompletion,

  getDefaultLlmTimeoutMs,

  getNvidiaConfig,

  normalizeChatMessages,

} from "@/lib/nvidia-llm";

import {

  checkRateLimit,

  clientRateKey,

  rateLimitRetryAfterSeconds,

} from "@/lib/security/rate-limit";



export async function GET() {

  const config = getNvidiaConfig();

  return NextResponse.json({

    ok: Boolean(config),

    provider: "nvidia",

    model: config?.model ?? null,

  });

}



export async function POST(request: NextRequest) {

  if (!authorizeLlmProxy(request)) {

    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  }



  const limit = checkRateLimit(clientRateKey("llm-chat", request), {

    windowMs: 60_000,

    max: 30,

  });

  if (!limit.allowed) {

    return NextResponse.json(

      { error: "Too many requests. Please slow down." },

      {

        status: 429,

        headers: { "retry-after": String(rateLimitRetryAfterSeconds(limit)) },

      },

    );

  }



  if (!getNvidiaConfig()) {

    return NextResponse.json(

      { error: "NVIDIA_API_KEY is not configured on AERIS CHAT." },

      { status: 503 },

    );

  }



  let body: unknown;

  try {

    body = await request.json();

  } catch {

    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });

  }



  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};

  const messages = normalizeChatMessages(record.messages);



  if (messages.length === 0) {

    const legacyMessage = typeof record.message === "string" ? record.message.trim() : "";

    if (legacyMessage) {

      messages.push({ role: "user", content: legacyMessage });

    }

  }



  if (messages.length === 0) {

    return NextResponse.json({ error: "At least one message is required." }, { status: 400 });

  }



  const config = getNvidiaConfig();

  const timeoutMs = getDefaultLlmTimeoutMs();

  const controller = new AbortController();

  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);



  try {

    const content = await callNvidiaChatCompletion(messages, {

      signal: controller.signal,

    });

    clearTimeout(timeoutId);

    return NextResponse.json(

      {

        message: content,

        content,

        provider: "nvidia",

        model: config?.model ?? null,

      },

      { status: 200, headers: { "cache-control": "no-store" } },

    );

  } catch (error) {

    clearTimeout(timeoutId);

    const err = error as Error;

    if (err?.name === "AbortError" || /timed out/i.test(err?.message ?? "")) {

      return NextResponse.json(

        { error: "Request timeout. NVIDIA LLM took too long to respond." },

        { status: 504, headers: { "cache-control": "no-store" } },

      );

    }

    return NextResponse.json(

      { error: err.message || "Failed to get AI response from NVIDIA." },

      { status: 502, headers: { "cache-control": "no-store" } },

    );

  }

}


