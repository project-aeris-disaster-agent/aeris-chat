-- Migration: Add development-friendly RLS policies for AUTH_DISABLED mode
-- This allows anonymous access to chat_sessions and messages when auth is disabled

-- Drop existing policies if they exist (for re-running migration)
DROP POLICY IF EXISTS "Allow anonymous session creation" ON public.chat_sessions;
DROP POLICY IF EXISTS "Allow anonymous session access" ON public.chat_sessions;
DROP POLICY IF EXISTS "Allow anonymous message creation" ON public.messages;
DROP POLICY IF EXISTS "Allow anonymous message access" ON public.messages;

-- Create policies that allow anonymous access (for development)
-- These policies check if auth.uid() is null OR matches user_id
CREATE POLICY "Allow anonymous session creation"
  ON public.chat_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);

CREATE POLICY "Allow anonymous session access"
  ON public.chat_sessions FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() IS NULL);

CREATE POLICY "Allow anonymous session update"
  ON public.chat_sessions FOR UPDATE
  USING (auth.uid() = user_id OR auth.uid() IS NULL);

CREATE POLICY "Allow anonymous session delete"
  ON public.chat_sessions FOR DELETE
  USING (auth.uid() = user_id OR auth.uid() IS NULL);

-- For messages, we need to check session ownership
CREATE POLICY "Allow anonymous message creation"
  ON public.messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_sessions
      WHERE chat_sessions.id = messages.session_id
      AND (chat_sessions.user_id = auth.uid() OR auth.uid() IS NULL)
    )
  );

CREATE POLICY "Allow anonymous message access"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions
      WHERE chat_sessions.id = messages.session_id
      AND (chat_sessions.user_id = auth.uid() OR auth.uid() IS NULL)
    )
  );

CREATE POLICY "Allow anonymous message update"
  ON public.messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions
      WHERE chat_sessions.id = messages.session_id
      AND (chat_sessions.user_id = auth.uid() OR auth.uid() IS NULL)
    )
  );

CREATE POLICY "Allow anonymous message delete"
  ON public.messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions
      WHERE chat_sessions.id = messages.session_id
      AND (chat_sessions.user_id = auth.uid() OR auth.uid() IS NULL)
    )
  );

