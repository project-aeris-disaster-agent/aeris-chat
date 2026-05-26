const NVIDIA_CHAT_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export function getNvidiaConfig() {
  const apiKey = process.env.NVIDIA_API_KEY?.trim();
  const model = process.env.LLM_MODEL?.trim() || "moonshotai/kimi-k2.6";
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
  const envMaxTokens = Number(process.env.LLM_MAX_TOKENS ?? "4096");
  const temperature = Number.isFinite(options.temperature)
    ? (options.temperature as number)
    : Number.isFinite(envTemperature)
      ? envTemperature
      : 0.7;
  const maxTokens = Number.isFinite(options.maxTokens)
    ? (options.maxTokens as number)
    : Number.isFinite(envMaxTokens)
      ? envMaxTokens
      : 4096;

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

  const response = await fetch(NVIDIA_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    signal: options.signal,
  });

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
  messages: ChatMessage[],
  options: NvidiaCallOptions = {},
): Promise<NvidiaChatResult> {
  const config = getNvidiaConfig();
  if (!config) {
    throw new Error("NVIDIA_API_KEY is not configured.");
  }

  const envTemperature = Number(process.env.LLM_TEMPERATURE ?? "0.7");
  const envMaxTokens = Number(process.env.LLM_MAX_TOKENS ?? "4096");
  const temperature = Number.isFinite(options.temperature)
    ? (options.temperature as number)
    : Number.isFinite(envTemperature)
      ? envTemperature
      : 0.7;
  const maxTokens = Number.isFinite(options.maxTokens)
    ? (options.maxTokens as number)
    : Number.isFinite(envMaxTokens)
      ? envMaxTokens
      : 4096;

  const body: Record<string, unknown> = {
    model: config.model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    max_tokens: maxTokens,
    temperature,
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

  const response = await fetch(NVIDIA_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    signal: options.signal,
  });

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
