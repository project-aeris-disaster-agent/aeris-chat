# Legacy documentation (deprecated)

The files in this folder describe an **earlier architecture** of AERIS CHAT
that has been retired. They are kept for historical reference only.

## What changed

Previously, AERIS CHAT proxied LLM traffic through one of two backends:

1. A **Flask service hosted on Railway** (`NEXT_PUBLIC_BACKEND_API_URL` +
   `LLM_API_KEY`) — see `RAILWAY_VERCEL_INTEGRATION.md`,
   `VERCEL_REDEPLOY_TEST.md`, `VERCEL_SETUP_QUICK.md`, `QUICK_REDEPLOY.md`,
   and the `test-*.ps1` smoke scripts.
2. An **HTTP LLM tunnel** (`NEXT_PUBLIC_LLM_API_URL` /
   `LLM_HTTP_API_BASE_URL`) — see `LLM_SETUP.md`.

Both branches have been removed from the code. The current setup is
NVIDIA-only and documented in [`../AGENT_CONTRACT.md`](../AGENT_CONTRACT.md).

## Why these are kept

- They explain why some env variable names (e.g. `LLM_API_KEY`) still exist
  in the current code with a different meaning.
- They document the Railway URL (`api-production-adbf.up.railway.app`) which
  may still appear in unrelated infrastructure.

## Do not follow these guides for new deployments

The current production wiring is:

- AERIS CHAT (this app) on Vercel → calls NVIDIA directly.
- AERIS DASHBOARD on Vercel → calls AERIS CHAT's `/api/llm/chat`.

See [`../AGENT_CONTRACT.md`](../AGENT_CONTRACT.md) and the AERIS DASHBOARD
repo's `docs/AGENT_BACKEND.md` for the live architecture.
