-- Operator and AI-agent review workflow for disaster reports.
-- Raw reports remain immutable claims; decisions are recorded as append-only
-- events so future agents can reason over provenance and review history.

ALTER TABLE public.disaster_reports
  ADD COLUMN IF NOT EXISTS reviewed_by TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS review_actor_type TEXT
    CHECK (
      review_actor_type IS NULL
      OR review_actor_type IN ('human_operator', 'ai_agent', 'system')
    ),
  ADD COLUMN IF NOT EXISTS operator_note TEXT;

CREATE TABLE IF NOT EXISTS public.report_review_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES public.disaster_reports(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL
    CHECK (actor_type IN ('human_operator', 'ai_agent', 'system')),
  actor_id TEXT,
  action TEXT NOT NULL
    CHECK (
      action IN (
        'verify',
        'reject',
        'duplicate',
        'hide',
        'unhide',
        'needs_review',
        'unverify',
        'note',
        'confidence_adjust'
      )
    ),
  previous_verification_status TEXT,
  new_verification_status TEXT,
  previous_moderation_status TEXT,
  new_moderation_status TEXT,
  confidence_before NUMERIC(3, 2),
  confidence_after NUMERIC(3, 2),
  note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_report_review_events_report_id_created_at
  ON public.report_review_events(report_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_report_review_events_actor
  ON public.report_review_events(actor_type, actor_id, created_at DESC);

ALTER TABLE public.report_review_events ENABLE ROW LEVEL SECURITY;

-- Review history is read through server/API workflows. Direct client access is
-- intentionally not opened here.
