-- Shared AERIS report intake table.
-- AERIS Chat writes consumer reports here; the dashboard reads the same table
-- and renders them as unverified intelligence until an operator corroborates
-- or moderates them.

CREATE TABLE IF NOT EXISTS public.disaster_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_app TEXT NOT NULL DEFAULT 'aeris-chat'
    CHECK (source_app IN ('aeris-chat', 'aeris-dashboard', 'external')),
  source_channel TEXT NOT NULL DEFAULT 'consumer_chat',
  category TEXT NOT NULL
    CHECK (category IN ('flood', 'landslide', 'stranded', 'SOS', 'infra_damage', 'power_out', 'road_closed')),
  description TEXT NOT NULL CHECK (char_length(description) BETWEEN 3 AND 280),
  longitude DOUBLE PRECISION NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  location_accuracy_m DOUBLE PRECISION,
  address_text TEXT,
  photo_url TEXT,
  severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'watch', 'warning', 'emergency')),
  confidence NUMERIC(3, 2) NOT NULL DEFAULT 0.25
    CHECK (confidence >= 0 AND confidence <= 1),
  verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected', 'duplicate')),
  moderation_status TEXT NOT NULL DEFAULT 'visible'
    CHECK (moderation_status IN ('visible', 'needs_review', 'hidden')),
  confirmations INTEGER NOT NULL DEFAULT 0 CHECK (confirmations >= 0),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anonymous_id TEXT,
  session_id UUID REFERENCES public.chat_sessions(id) ON DELETE SET NULL,
  message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  ip_hash TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_disaster_reports_created_at
  ON public.disaster_reports(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_disaster_reports_location
  ON public.disaster_reports(latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_disaster_reports_status
  ON public.disaster_reports(verification_status, moderation_status);

CREATE INDEX IF NOT EXISTS idx_disaster_reports_source
  ON public.disaster_reports(source_app, source_channel);

ALTER TABLE public.disaster_reports ENABLE ROW LEVEL SECURITY;

-- Direct client reads are intentionally narrow. Server routes use the service
-- role key for dashboard/operator views and moderation workflows.
CREATE POLICY "Users can view own disaster reports"
  ON public.disaster_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own disaster reports"
  ON public.disaster_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_disaster_reports_updated_at
  BEFORE UPDATE ON public.disaster_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
