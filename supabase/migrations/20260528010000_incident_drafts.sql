-- Phase 5.1: persist multi-turn incident drafts.
--
-- Each row represents an AI-proposed draft tied to the user-message that
-- triggered it. Drafts survive page reloads, can be progressively refined
-- via /api/incidents/draft/refine, and reach a terminal state when the
-- user confirms, cancels, or the draft expires.

CREATE TABLE IF NOT EXISTS public.incident_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  user_message_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  anonymous_id text,
  draft jsonb NOT NULL,
  missing_slots text[] NOT NULL DEFAULT '{}'::text[],
  next_question text,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'confirmed', 'cancelled', 'expired')),
  confirmed_report_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_incident_drafts_session
  ON public.incident_drafts (session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_incident_drafts_user_message
  ON public.incident_drafts (user_message_id);

CREATE INDEX IF NOT EXISTS idx_incident_drafts_open
  ON public.incident_drafts (session_id, status)
  WHERE status = 'open';

-- Touch updated_at on each row update.
CREATE OR REPLACE FUNCTION public.touch_incident_drafts_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_incident_drafts_updated_at ON public.incident_drafts;
CREATE TRIGGER trg_incident_drafts_updated_at
  BEFORE UPDATE ON public.incident_drafts
  FOR EACH ROW EXECUTE FUNCTION public.touch_incident_drafts_updated_at();
