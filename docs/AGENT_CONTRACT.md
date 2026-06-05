# AERIS Agent HTTP Contract

This document is the **source of truth** for the HTTP seam between AERIS CHAT
and any agent client (the AERIS DASHBOARD today; future MCP servers, Vercel
AI SDK adapters, or self-hosted LLM swaps tomorrow).

> Treat this contract as **frozen**. Adding optional fields is allowed; renaming
> or removing documented fields is a breaking change and requires a coordinated
> rollout across every consumer listed in the AERIS DASHBOARD repo's
> `docs/AGENT_BACKEND.md`.

## Endpoint

`POST /api/llm/chat` &nbsp;·&nbsp; runtime `nodejs` &nbsp;·&nbsp; `maxDuration: 120`

Implementation: [`app/api/llm/chat/route.ts`](../app/api/llm/chat/route.ts).

## Authentication

When `LLM_API_KEY` is set in the AERIS CHAT environment, requests **must**
include:

```
Authorization: Bearer <LLM_API_KEY>
```

The dashboard reads this same secret as `AERIS_CHAT_API_KEY` (falling back
to its own `LLM_API_KEY` if unset). Both projects MUST hold the **identical**
value.

If `LLM_API_KEY` is unset on AERIS CHAT, the route allows anonymous calls
(useful for local dev only — do not deploy that way).

## Request

```json
{
  "messages": [
    { "role": "system" | "user" | "assistant", "content": "string" }
  ]
}
```

- `messages` is required, non-empty.
- Messages are normalized server-side: trimmed, role-filtered, capped to the
  last 20 entries.
- A legacy `{ "message": "string" }` body is accepted and converted to a
  single user message. Prefer the array form.

## Response

### 200 OK

```json
{
  "message": "string",
  "content": "string",
  "provider": "nvidia",
  "model": "string"
}
```

- `message` and `content` are the same string (kept for backwards compatibility
  with two generations of consumers).
- `provider` is the upstream LLM family. Today always `"nvidia"`. Future
  providers (self-hosted Hermes, OpenAI-compatible local servers) will use
  their own slug.
- `model` echoes `LLM_MODEL` from the AERIS CHAT environment.
- Response headers include `cache-control: no-store`.

### Errors

| Status | Meaning | Body |
|--------|---------|------|
| `400`  | Invalid JSON, or no usable messages after normalization | `{ "error": string }` |
| `401`  | Missing or wrong bearer token | `{ "error": "Unauthorized." }` |
| `503`  | `NVIDIA_API_KEY` not configured on AERIS CHAT | `{ "error": string }` |
| `504`  | Upstream NVIDIA timeout | `{ "error": string }` |
| `502`  | Upstream NVIDIA error (rate limit, bad key, model not found, etc.) | `{ "error": string }` |
| `500`  | Unexpected server error | `{ "error": string }` |

Consumers should **only** branch on these status codes; do not depend on
exact error strings.

## Health check

`GET /api/llm/chat`

```json
{
  "ok": true,
  "provider": "nvidia",
  "model": "meta/llama-4-maverick-17b-128e-instruct"
}
```

`ok` is `false` when `NVIDIA_API_KEY` is missing. `model` is `null` in that
case. Use this for deploy smoke tests and external monitoring.

## Stability guarantees

- Status codes in the error table above are stable.
- `message`, `content`, `provider`, `model` fields on 200 responses are stable.
- `provider` and `model` are always present on 200 responses, even when the
  upstream provider does not echo them.
- New optional fields may be added to either request or response without
  notice; consumers MUST ignore unknown fields.

## Forward compatibility

The following are **planned** and will live alongside this route without
changing the contract above:

- `GET /api/llm/capabilities` — returns model id, supported tools, supported
  skills. Needed before exposing AERIS over MCP.
- Streaming variant via `Accept: text/event-stream` on the same POST.
- Tool-calling loop (the request shape will gain an optional `tools` array;
  the response will gain an optional `tool_calls` array). Today the
  primitives exist in [`../lib/incidents/agent-tools.ts`](../lib/incidents/agent-tools.ts)
  but are not wired into this endpoint.
- Provider abstraction inside [`../lib/nvidia-llm.ts`](../lib/nvidia-llm.ts)
  so swapping NVIDIA for a self-hosted Hermes or OpenChat endpoint is a
  one-file change. `provider` in the response is the contract surface that
  makes this safe.

## Consumers

See the AERIS DASHBOARD repo's `docs/AGENT_BACKEND.md` for the authoritative
list of call sites that depend on this contract.
