const NVIDIA_CHAT_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type AgentAssistantMessage = {
  role: "assistant";
  content: string | null;
  tool_calls?: NvidiaToolCall[];
};

export type AgentToolMessage = {
  role: "tool";
  tool_call_id: string;
  content: string;
};

export type AgentMessage = ChatMessage | AgentAssistantMessage | AgentToolMessage;

export function serializeAgentMessages(messages: AgentMessage[]): Record<string, unknown>[] {
  return messages.map((message) => {
    if (message.role === "tool") {
      return {
        role: "tool",
        tool_call_id: message.tool_call_id,
        content: message.content,
      };
    }
    if (message.role === "assistant" && "tool_calls" in message && message.tool_calls?.length) {
      return {
        role: "assistant",
        content: message.content ?? null,
        tool_calls: message.tool_calls,
      };
    }
    return {
      role: message.role,
      content: "content" in message ? message.content : "",
    };
  });
}

const DEFAULT_MODEL = "meta/llama-3.3-70b-instruct";
const DEFAULT_MAX_TOKENS = 2048;

export function getDefaultLlmTimeoutMs(): number {
  const ms = Number(process.env.LLM_TIMEOUT_MS ?? "55000");
  return Number.isFinite(ms) && ms > 0 ? ms : 55_000;
}

export function getNvidiaConfig() {
  const apiKey = process.env.NVIDIA_API_KEY?.trim();
  const model = process.env.LLM_MODEL?.trim() || DEFAULT_MODEL;
  if (!apiKey) return null;
  return { apiKey, model };
}

export type NvidiaJsonSchema = Record<string, unknown>;

export type NvidiaToolDef = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: NvidiaJsonSchema;
  };
};

export type NvidiaCallOptions = {
  signal?: AbortSignal;
  temperature?: number;
  maxTokens?: number;
  /**
   * When true, asks the model to emit a strict JSON object via the
   * OpenAI-compatible `response_format` parameter. The caller is still
   * responsible for parsing and validating the result.
   */
  jsonMode?: boolean;
  /** Optional tool definitions for OpenAI-style tool calling. */
  tools?: NvidiaToolDef[];
  /**
   * Force-call a specific tool by name, "auto" (default when tools provided),
   * or "none".
   */
  toolChoice?:
    | "auto"
    | "none"
    | { type: "function"; function: { name: string } };
};

export type NvidiaToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type NvidiaChatResult = {
  content: string;
  toolCalls: NvidiaToolCall[];
};

export async function callNvidiaChatCompletion(
  messages: ChatMessage[],
  options: NvidiaCallOptions = {},
): Promise<string> {
  const config = getNvidiaConfig();
  if (!config) {
    throw new Error("NVIDIA_API_KEY is not configured.");
  }

  const envTemperature = Number(process.env.LLM_TEMPERATURE ?? "0.7");
  const envMaxTokens = Number(process.env.LLM_MAX_TOKENS ?? String(DEFAULT_MAX_TOKENS));
  const temperature = Number.isFinite(options.temperature)
    ? (options.temperature as number)
    : Number.isFinite(envTemperature)
      ? envTemperature
      : 0.7;
  const maxTokens = Number.isFinite(options.maxTokens)
    ? (options.maxTokens as number)
    : Number.isFinite(envMaxTokens)
      ? envMaxTokens
      : DEFAULT_MAX_TOKENS;

  const body: Record<string, unknown> = {
    model: config.model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    max_tokens: maxTokens,
    temperature,
    top_p: 1,
    stream: false,
  };

  if (options.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  if (options.tools && options.tools.length > 0) {
    body.tools = options.tools;
    body.tool_choice = options.toolChoice ?? "auto";
  }

  const timeoutMs = getDefaultLlmTimeoutMs();
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

  let signal = options.signal;
  if (signal) {
    signal.addEventListener("abort", () => timeoutController.abort(), { once: true });
  } else {
    signal = timeoutController.signal;
  }

  let response: Response;
  try {
    response = await fetch(NVIDIA_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`NVIDIA LLM request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const data = (await response.json().catch(() => ({}))) as {
    choices?: Array<{
      message?: {
        content?: string;
        tool_calls?: NvidiaToolCall[];
      };
    }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(data.error?.message ?? `NVIDIA API error (${response.status})`);
  }

  const messageObj = data.choices?.[0]?.message ?? {};
  const toolCalls = Array.isArray(messageObj.tool_calls) ? messageObj.tool_calls : [];
  const content = typeof messageObj.content === "string" ? messageObj.content : "";

  if (!content.trim() && toolCalls.length === 0) {
    throw new Error("NVIDIA API returned an empty response.");
  }

  return content;
}

export async function callNvidiaWithTools(
  messages: AgentMessage[],
  options: NvidiaCallOptions = {},
): Promise<NvidiaChatResult> {
  const config = getNvidiaConfig();
  if (!config) {
    throw new Error("NVIDIA_API_KEY is not configured.");
  }

  const envTemperature = Number(process.env.LLM_TEMPERATURE ?? "0.7");
  const envMaxTokens = Number(process.env.LLM_MAX_TOKENS ?? String(DEFAULT_MAX_TOKENS));
  const temperature = Number.isFinite(options.temperature)
    ? (options.temperature as number)
    : Number.isFinite(envTemperature)
      ? envTemperature
      : 0.7;
  const maxTokens = Number.isFinite(options.maxTokens)
    ? (options.maxTokens as number)
    : Number.isFinite(envMaxTokens)
      ? envMaxTokens
      : DEFAULT_MAX_TOKENS;

  return callNvidiaAgentTurn(messages, {
    ...options,
    temperature,
    maxTokens,
  });
}

export function getWeatherToolLoopMaxSteps(): number {
  const steps = Number(process.env.WEATHER_TOOL_LOOP_MAX_STEPS ?? "2");
  return Number.isFinite(steps) && steps >= 1 && steps <= 4 ? steps : 2;
}

async function callNvidiaAgentTurn(
  messages: AgentMessage[],
  options: NvidiaCallOptions & { temperature: number; maxTokens: number },
): Promise<NvidiaChatResult> {
  const config = getNvidiaConfig();
  if (!config) {
    throw new Error("NVIDIA_API_KEY is not configured.");
  }

  const body: Record<string, unknown> = {
    model: config.model,
    messages: serializeAgentMessages(messages),
    max_tokens: options.maxTokens,
    temperature: options.temperature,
    top_p: 1,
    stream: false,
  };

  if (options.tools && options.tools.length > 0) {
    body.tools = options.tools;
    body.tool_choice = options.toolChoice ?? "auto";
  }

  if (options.jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const timeoutMs = getDefaultLlmTimeoutMs();
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

  let signal = options.signal;
  if (signal) {
    signal.addEventListener("abort", () => timeoutController.abort(), { once: true });
  } else {
    signal = timeoutController.signal;
  }

  let response: Response;
  try {
    response = await fetch(NVIDIA_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`NVIDIA LLM request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const data = (await response.json().catch(() => ({}))) as {
    choices?: Array<{
      message?: {
        content?: string;
        tool_calls?: NvidiaToolCall[];
      };
    }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(data.error?.message ?? `NVIDIA API error (${response.status})`);
  }

  const messageObj = data.choices?.[0]?.message ?? {};
  return {
    content: typeof messageObj.content === "string" ? messageObj.content : "",
    toolCalls: Array.isArray(messageObj.tool_calls) ? messageObj.tool_calls : [],
  };
}

export function normalizeChatMessages(raw: unknown): ChatMessage[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const role = record.role;
      const content = record.content;
      if (
        (role !== "system" && role !== "user" && role !== "assistant") ||
        typeof content !== "string"
      ) {
        return null;
      }
      return { role, content: content.trim() };
    })
    .filter((m): m is ChatMessage => Boolean(m && m.content.length > 0))
    .slice(-20);
}

export function authorizeLlmProxy(request: Request): boolean {
  const expected = process.env.LLM_API_KEY?.trim();
  if (!expected) return true;
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${expected}`;
}
