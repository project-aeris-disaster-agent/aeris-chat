export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

import { NextRequest, NextResponse } from "next/server";
import {
  authorizeLlmProxy,
  callNvidiaChatCompletion,
  getNvidiaConfig,
  normalizeChatMessages,
} from "@/lib/nvidia-llm";

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

  try {
    const content = await callNvidiaChatCompletion(messages);
    return NextResponse.json(
      {
        message: content,
        content,
        provider: "nvidia",
      },
      { status: 200, headers: { "cache-control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 502, headers: { "cache-control": "no-store" } },
    );
  }
}
