# Aeris Chat - AI Chatbot Web Application

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your actual values
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

See `spec.md` for complete specifications and architecture details.

## Tech Stack

- Next.js 14+ (App Router)
- TypeScript
- Tailwind CSS
- Supabase (Database & Auth)
- React Query (State Management)
- React Hook Form + Zod (Form Handling)
- NVIDIA LLM (via `lib/nvidia-llm.ts`)

## Role in the AERIS system

This app is both:

1. **A citizen chatbot** (`/api/chat`, full Supabase-backed sessions), and
2. **The agent backend** for the AERIS DASHBOARD via the frozen
   `/api/llm/chat` HTTP contract documented in
   [`docs/AGENT_CONTRACT.md`](docs/AGENT_CONTRACT.md).

The dashboard never calls NVIDIA directly — every LLM call in the dashboard
proxies through this app. When changing `/api/llm/chat`, update
`docs/AGENT_CONTRACT.md` and verify every dashboard call site listed in the
AERIS DASHBOARD repo's `docs/AGENT_BACKEND.md`. There is no shared package
between the two repos; the HTTP contract is the source of truth.

Older Railway-on-Flask and HTTP-LLM-tunnel docs have been moved to
[`docs/legacy/`](docs/legacy/) and no longer reflect the live architecture.

