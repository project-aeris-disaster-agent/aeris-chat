import {
  callNvidiaWithTools,
  getWeatherToolLoopMaxSteps,
  type AgentMessage,
  type NvidiaCallOptions,
  type NvidiaToolCall,
  type NvidiaToolDef,
} from "@/lib/nvidia-llm";

export type AgentLoopOptions = Omit<NvidiaCallOptions, "tools"> & {
  tools: NvidiaToolDef[];
  maxSteps?: number;
  runTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
};

function safeParseToolArgs(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/**
 * Some NVIDIA-hosted models (e.g. llama-4-maverick) emit tool calls as plain
 * text in the content field instead of populating `tool_calls`. This salvages
 * those so they get executed rather than shown to the user.
 *
 * Recognized shapes (optionally wrapped in markdown fences or <tool_call> tags):
 *   {"type":"function","name":"get_weather_forecast","parameters":{...}}
 *   {"name":"get_weather_forecast","arguments":{...}}
 *   [{...}, {...}]
 */
export function extractInlineToolCalls(
  content: string,
  knownToolNames: Set<string>,
): NvidiaToolCall[] {
  if (!content || !content.includes("{")) return [];

  const candidates: unknown[] = [];
  const objectRegex = /\{[\s\S]*?\}(?=\s*[,\]\n]|\s*$)/g;

  // First try parsing the whole trimmed content (most common: single object).
  const stripped = content
    .replace(/```(?:json)?/gi, "")
    .replace(/<\/?tool_call>/gi, "")
    .trim();

  const tryPush = (text: string) => {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) candidates.push(...parsed);
      else candidates.push(parsed);
    } catch {
      // ignore
    }
  };

  tryPush(stripped);

  if (candidates.length === 0) {
    const matches = stripped.match(objectRegex);
    if (matches) {
      for (const match of matches) tryPush(match);
    }
  }

  const toolCalls: NvidiaToolCall[] = [];
  candidates.forEach((candidate, index) => {
    if (!candidate || typeof candidate !== "object") return;
    const record = candidate as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name : undefined;
    if (!name || !knownToolNames.has(name)) return;

    const rawArgs = record.parameters ?? record.arguments ?? {};
    const argsString =
      typeof rawArgs === "string" ? rawArgs : JSON.stringify(rawArgs ?? {});

    toolCalls.push({
      id: `inline_${Date.now()}_${index}`,
      type: "function",
      function: { name, arguments: argsString },
    });
  });

  return toolCalls;
}

export async function runAgentLoop(
  initialMessages: AgentMessage[],
  options: AgentLoopOptions,
): Promise<string> {
  const messages: AgentMessage[] = [...initialMessages];
  const maxSteps = options.maxSteps ?? getWeatherToolLoopMaxSteps();
  const knownToolNames = new Set(options.tools.map((tool) => tool.function.name));
  // Some models re-call a tool they already used this turn (observed with
  // get_active_typhoons, which takes no args and never needs a second call).
  // Cache by name+args so a repeat resolves instantly from memory instead of
  // spending a full network round trip out of the tight step/time budget.
  const toolResultCache = new Map<string, Promise<unknown>>();

  for (let step = 0; step < maxSteps; step += 1) {
    const result = await callNvidiaWithTools(messages, {
      signal: options.signal,
      temperature: options.temperature,
      maxTokens: options.maxTokens,
      tools: options.tools,
      toolChoice: options.toolChoice,
    });

    // Prefer structured tool_calls; fall back to parsing inline JSON the model
    // emitted as text content (common with weaker tool-calling models).
    let toolCalls = result.toolCalls;
    let assistantContent: string | null = result.content || null;
    if (toolCalls.length === 0) {
      const inline = extractInlineToolCalls(result.content, knownToolNames);
      if (inline.length > 0) {
        toolCalls = inline;
        assistantContent = null;
      }
    }

    if (toolCalls.length === 0) {
      if (result.content.trim()) return result.content.trim();
      throw new Error("Agent loop returned empty content.");
    }

    messages.push({
      role: "assistant",
      content: assistantContent,
      tool_calls: toolCalls,
    });

    for (const toolCall of toolCalls) {
      const args = safeParseToolArgs(toolCall.function.arguments);
      const cacheKey = `${toolCall.function.name}:${JSON.stringify(args)}`;
      let resultPromise = toolResultCache.get(cacheKey);
      if (!resultPromise) {
        resultPromise = options.runTool(toolCall.function.name, args);
        toolResultCache.set(cacheKey, resultPromise);
      }
      const toolResult = await resultPromise;
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolResult),
      });
    }
  }

  const final = await callNvidiaWithTools(messages, {
    signal: options.signal,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
    toolChoice: "none",
  });

  if (final.content.trim()) {
    return final.content.trim();
  }

  // Last resort: if the model still emitted an inline tool call instead of
  // prose, surface a graceful message rather than raw JSON.
  if (extractInlineToolCalls(final.content, knownToolNames).length > 0) {
    throw new Error("Agent loop could not produce a natural-language answer.");
  }
  throw new Error("Agent loop failed to produce a final response.");
}
