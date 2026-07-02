/**
 * Input validation guardrail for chat-style payloads.
 *
 * Centralizes the size/shape limits previously scattered (or missing) across
 * routes: per-message length caps, total message caps, role/empty checks. This
 * bounds token cost and rejects malformed or abusive payloads early.
 */

import { z } from "zod";

export const CHAT_ROLES = ["system", "user", "assistant"] as const;
export type ChatRole = (typeof CHAT_ROLES)[number];

export type ValidatedMessage = { role: ChatRole; content: string };

export function maxMessageChars(): number {
  const raw = Number(process.env.MAX_MESSAGE_CHARS);
  return Number.isFinite(raw) && raw > 0 ? raw : 4000;
}

export function maxMessagesPerRequest(): number {
  const raw = Number(process.env.MAX_MESSAGES_PER_REQUEST);
  return Number.isFinite(raw) && raw > 0 ? raw : 20;
}

export type ValidationFailure = {
  ok: false;
  /** HTTP status to return (400 malformed, 413 too large). */
  status: 400 | 413;
  error: string;
};

export type ValidationSuccess = {
  ok: true;
  messages: ValidatedMessage[];
};

export type ValidationResult = ValidationSuccess | ValidationFailure;

/**
 * Validate and normalize a raw `messages` array from a request body.
 *
 * - Drops malformed entries (non-object, missing/non-string fields, unknown
 *   roles, empty-after-trim content).
 * - Enforces a per-message character cap (413 when any message exceeds it).
 * - Enforces a max message count (keeps only the most recent N).
 * - Returns 400 when nothing usable remains.
 */
export function validateChatMessages(raw: unknown): ValidationResult {
  if (!Array.isArray(raw)) {
    return { ok: false, status: 400, error: "messages must be an array." };
  }

  const limit = maxMessageChars();

  const itemSchema = z.object({
    role: z.enum(CHAT_ROLES),
    content: z.string(),
  });

  const cleaned: ValidatedMessage[] = [];
  for (const item of raw) {
    const parsed = itemSchema.safeParse(item);
    if (!parsed.success) continue;
    const content = parsed.data.content.trim();
    if (content.length === 0) continue;
    if (content.length > limit) {
      return {
        ok: false,
        status: 413,
        error: `Message too long. Maximum ${limit} characters per message.`,
      };
    }
    cleaned.push({ role: parsed.data.role, content });
  }

  if (cleaned.length === 0) {
    return {
      ok: false,
      status: 400,
      error: "Invalid messages: at least one non-empty message is required.",
    };
  }

  return { ok: true, messages: cleaned.slice(-maxMessagesPerRequest()) };
}

/**
 * Validate a single free-text field (used by incident draft routes).
 * Returns the trimmed string or a failure with the right HTTP status.
 */
export function validateSingleMessage(raw: unknown): { ok: true; message: string } | ValidationFailure {
  if (typeof raw !== "string") {
    return { ok: false, status: 400, error: "message is required" };
  }
  const message = raw.trim();
  if (message.length === 0) {
    return { ok: false, status: 400, error: "message is required" };
  }
  if (message.length > maxMessageChars()) {
    return { ok: false, status: 413, error: "message too long" };
  }
  return { ok: true, message };
}
