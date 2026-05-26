-- Aligns disaster_reports with AERIS CHAT + AERIS DASHBOARD code that already
-- references these columns (lib/reports/shared-supabase.ts in chat,
-- lib/supabase-reports.ts in dashboard). Without these, report inserts from
-- chat fall back to the local file store and real-time AI triage never fires.
--
-- Each column uses ADD COLUMN IF NOT EXISTS so the migration is idempotent and
-- safe to apply against environments that already have any subset of the
-- columns from earlier ad-hoc hotfixes.

ALTER TABLE public.disaster_reports
  ADD COLUMN IF NOT EXISTS report_message_id text,
  ADD COLUMN IF NOT EXISTS phone_verification_status text
    NOT NULL DEFAULT 'unverified'
    CHECK (phone_verification_status IN ('unverified', 'otp_requested', 'verified')),
  ADD COLUMN IF NOT EXISTS proxy_wallet_id uuid,
  ADD COLUMN IF NOT EXISTS proxy_wallet_address text,
  ADD COLUMN IF NOT EXISTS onchain_network text
    NOT NULL DEFAULT 'base-mainnet',
  ADD COLUMN IF NOT EXISTS onchain_chain_id integer
    NOT NULL DEFAULT 8453,
  ADD COLUMN IF NOT EXISTS onchain_mint_status text
    NOT NULL DEFAULT 'not_started'
    CHECK (onchain_mint_status IN ('not_started', 'queued', 'minted', 'failed')),
  ADD COLUMN IF NOT EXISTS onchain_tx_hash text,
  ADD COLUMN IF NOT EXISTS onchain_token_id text,
  ADD COLUMN IF NOT EXISTS onchain_minted_at timestamptz;

-- report_message_id is used as a human-friendly identifier surfaced to users
-- (e.g. AERIS-20260527-AB12CD34). Enforce uniqueness where present so retries
-- and duplicates can be detected, but allow NULL for legacy rows.
CREATE UNIQUE INDEX IF NOT EXISTS uq_disaster_reports_report_message_id
  ON public.disaster_reports (report_message_id)
  WHERE report_message_id IS NOT NULL;

-- Fast lookups for the mint queue when the on-chain worker runs.
CREATE INDEX IF NOT EXISTS idx_disaster_reports_onchain_mint_status
  ON public.disaster_reports (onchain_mint_status, created_at DESC)
  WHERE onchain_mint_status IN ('queued', 'failed');

-- Fast filter for "needs OTP" / "verified phone" dashboards.
CREATE INDEX IF NOT EXISTS idx_disaster_reports_phone_verification_status
  ON public.disaster_reports (phone_verification_status, created_at DESC);
