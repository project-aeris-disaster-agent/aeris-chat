-- Security hardening: stop trusting the public anon key for anonymous data.
--
-- Background: the previous "Allow anonymous ..." policies (20251111000000) and
-- the anonymous-session policies (20251111012345) permit SELECT/INSERT/UPDATE/
-- DELETE on chat_sessions and messages whenever `auth.uid() IS NULL`. Because
-- NEXT_PUBLIC_SUPABASE_ANON_KEY is shipped to every browser, anyone can call the
-- Supabase REST API directly with that key and read or modify EVERY anonymous
-- session and message — RLS cannot see the request's anonymousId, so the real
-- ownership check only exists in our API routes, which the anon key bypasses.
--
-- Fix: revoke the permissive anonymous policies. All anonymous reads/writes
-- already flow through our server API routes using the SERVICE ROLE key, which
-- bypasses RLS — so anonymous UX is unaffected. Authenticated-user policies
-- (auth.uid() = user_id) remain intact. We also enable RLS on incident_drafts,
-- which previously had none, and add no anon policy (service-role only).

-- 1. chat_sessions: drop anon-open policies from both prior migrations.
DROP POLICY IF EXISTS "Allow anonymous session creation" ON public.chat_sessions;
DROP POLICY IF EXISTS "Allow anonymous session access" ON public.chat_sessions;
DROP POLICY IF EXISTS "Allow anonymous session update" ON public.chat_sessions;
DROP POLICY IF EXISTS "Allow anonymous session delete" ON public.chat_sessions;

-- 2. messages: drop anon-open policies from both prior migrations.
DROP POLICY IF EXISTS "Allow anonymous message creation" ON public.messages;
DROP POLICY IF EXISTS "Allow anonymous message access" ON public.messages;
DROP POLICY IF EXISTS "Allow anonymous message update" ON public.messages;
DROP POLICY IF EXISTS "Allow anonymous message delete" ON public.messages;

-- 3. Re-assert strict authenticated-owner policies (idempotent). The service
--    role used by API routes bypasses RLS, so anonymous flows keep working.
DROP POLICY IF EXISTS "Users can view own sessions" ON public.chat_sessions;
CREATE POLICY "Users can view own sessions"
  ON public.chat_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own sessions" ON public.chat_sessions;
CREATE POLICY "Users can create own sessions"
  ON public.chat_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sessions" ON public.chat_sessions;
CREATE POLICY "Users can update own sessions"
  ON public.chat_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own sessions" ON public.chat_sessions;
CREATE POLICY "Users can delete own sessions"
  ON public.chat_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view messages from own sessions" ON public.messages;
CREATE POLICY "Users can view messages from own sessions"
  ON public.messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions
      WHERE chat_sessions.id = messages.session_id
        AND chat_sessions.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create messages in own sessions" ON public.messages;
CREATE POLICY "Users can create messages in own sessions"
  ON public.messages FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_sessions
      WHERE chat_sessions.id = messages.session_id
        AND chat_sessions.user_id = auth.uid()
    )
  );

-- 4. incident_drafts: enable RLS (was missing entirely). No anon/authenticated
--    policy is added, so only the service role (API routes) can access it.
ALTER TABLE public.incident_drafts ENABLE ROW LEVEL SECURITY;
