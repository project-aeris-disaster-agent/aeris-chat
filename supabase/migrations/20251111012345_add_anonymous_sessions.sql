-- Migration: Add anonymous session support
-- Makes user_id nullable and adds anonymous_id for browser-based tracking
-- This allows emergency chat access without authentication

-- Step 1: Make user_id nullable (allows anonymous sessions)
ALTER TABLE public.chat_sessions 
  ALTER COLUMN user_id DROP NOT NULL;

-- Step 2: Add anonymous_id column for browser session tracking
ALTER TABLE public.chat_sessions 
  ADD COLUMN IF NOT EXISTS anonymous_id TEXT;

-- Step 3: Add constraint: either user_id OR anonymous_id must exist
ALTER TABLE public.chat_sessions 
  DROP CONSTRAINT IF EXISTS chat_sessions_user_or_anonymous_check;

ALTER TABLE public.chat_sessions 
  ADD CONSTRAINT chat_sessions_user_or_anonymous_check 
  CHECK (
    (user_id IS NOT NULL) OR 
    (anonymous_id IS NOT NULL)
  );

-- Step 4: Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_chat_sessions_anonymous_id 
  ON public.chat_sessions(anonymous_id);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id_nullable 
  ON public.chat_sessions(user_id) WHERE user_id IS NOT NULL;

-- Step 5: Update RLS policies to allow anonymous sessions
DROP POLICY IF EXISTS "Users can view own sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can create own sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can update own sessions" ON public.chat_sessions;
DROP POLICY IF EXISTS "Users can delete own sessions" ON public.chat_sessions;

-- New policies supporting both authenticated and anonymous
CREATE POLICY "Users can view own sessions"
  ON public.chat_sessions FOR SELECT
  USING (
    auth.uid() = user_id OR 
    (user_id IS NULL AND anonymous_id IS NOT NULL)
  );

CREATE POLICY "Users can create own sessions"
  ON public.chat_sessions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id OR 
    (user_id IS NULL AND anonymous_id IS NOT NULL)
  );

CREATE POLICY "Users can update own sessions"
  ON public.chat_sessions FOR UPDATE
  USING (
    auth.uid() = user_id OR 
    (user_id IS NULL AND anonymous_id IS NOT NULL)
  );

CREATE POLICY "Users can delete own sessions"
  ON public.chat_sessions FOR DELETE
  USING (
    auth.uid() = user_id OR 
    (user_id IS NULL AND anonymous_id IS NOT NULL)
  );

-- Step 6: Update messages RLS policies to support anonymous sessions
DROP POLICY IF EXISTS "Users can view messages from own sessions" ON public.messages;
DROP POLICY IF EXISTS "Users can create messages in own sessions" ON public.messages;
DROP POLICY IF EXISTS "Users can update messages in own sessions" ON public.messages;
DROP POLICY IF EXISTS "Users can delete messages from own sessions" ON public.messages;

CREATE POLICY "Users can view messages from own sessions"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions
      WHERE chat_sessions.id = messages.session_id
      AND (
        chat_sessions.user_id = auth.uid() OR
        (chat_sessions.user_id IS NULL AND chat_sessions.anonymous_id IS NOT NULL)
      )
    )
  );

CREATE POLICY "Users can create messages in own sessions"
  ON public.messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_sessions
      WHERE chat_sessions.id = messages.session_id
      AND (
        chat_sessions.user_id = auth.uid() OR
        (chat_sessions.user_id IS NULL AND chat_sessions.anonymous_id IS NOT NULL)
      )
    )
  );

CREATE POLICY "Users can update messages in own sessions"
  ON public.messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions
      WHERE chat_sessions.id = messages.session_id
      AND (
        chat_sessions.user_id = auth.uid() OR
        (chat_sessions.user_id IS NULL AND chat_sessions.anonymous_id IS NOT NULL)
      )
    )
  );

CREATE POLICY "Users can delete messages from own sessions"
  ON public.messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions
      WHERE chat_sessions.id = messages.session_id
      AND (
        chat_sessions.user_id = auth.uid() OR
        (chat_sessions.user_id IS NULL AND chat_sessions.anonymous_id IS NOT NULL)
      )
    )
  );

