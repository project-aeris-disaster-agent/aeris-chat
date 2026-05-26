-- AI triage columns on disaster_reports + operator role assignments

ALTER TABLE public.disaster_reports
  ADD COLUMN IF NOT EXISTS ai_priority text NOT NULL DEFAULT 'pending'
    CHECK (ai_priority IN ('pending', 'urgent', 'low_priority', 'rejected')),
  ADD COLUMN IF NOT EXISTS ai_triage_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_triage_rationale text,
  ADD COLUMN IF NOT EXISTS ai_triage_confidence numeric,
  ADD COLUMN IF NOT EXISTS dedupe_hash text;

CREATE INDEX IF NOT EXISTS idx_disaster_reports_ai_priority
  ON public.disaster_reports (ai_priority, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_disaster_reports_dedupe_hash
  ON public.disaster_reports (dedupe_hash, created_at DESC)
  WHERE dedupe_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.aeris_user_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('volunteer', 'admin')),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.aeris_user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS aeris_user_roles_select_own ON public.aeris_user_roles;
CREATE POLICY aeris_user_roles_select_own
  ON public.aeris_user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS aeris_user_roles_service_all ON public.aeris_user_roles;
CREATE POLICY aeris_user_roles_service_all
  ON public.aeris_user_roles
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
