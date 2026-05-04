-- Prepare reports for future BASE mainnet gasless minting.
-- The application assigns a stable report_message_id now; OTP, proxy wallet,
-- and mint transaction fields are populated as the verification/minting flow
-- comes online.

ALTER TABLE public.disaster_reports
  ADD COLUMN IF NOT EXISTS report_message_id TEXT,
  ADD COLUMN IF NOT EXISTS phone_verification_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (phone_verification_status IN ('unverified', 'pending', 'verified', 'failed')),
  ADD COLUMN IF NOT EXISTS phone_verified_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS proxy_wallet_id UUID,
  ADD COLUMN IF NOT EXISTS proxy_wallet_address TEXT,
  ADD COLUMN IF NOT EXISTS onchain_network TEXT NOT NULL DEFAULT 'base-mainnet',
  ADD COLUMN IF NOT EXISTS onchain_chain_id INTEGER NOT NULL DEFAULT 8453,
  ADD COLUMN IF NOT EXISTS onchain_mint_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (onchain_mint_status IN ('not_started', 'queued', 'minting', 'minted', 'failed')),
  ADD COLUMN IF NOT EXISTS onchain_tx_hash TEXT,
  ADD COLUMN IF NOT EXISTS onchain_token_id TEXT,
  ADD COLUMN IF NOT EXISTS onchain_minted_at TIMESTAMP WITH TIME ZONE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_disaster_reports_report_message_id
  ON public.disaster_reports(report_message_id)
  WHERE report_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_disaster_reports_onchain_status
  ON public.disaster_reports(phone_verification_status, onchain_mint_status);

CREATE TABLE IF NOT EXISTS public.report_proxy_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  anonymous_id TEXT,
  phone_hash TEXT NOT NULL,
  chain_id INTEGER NOT NULL DEFAULT 8453,
  network TEXT NOT NULL DEFAULT 'base-mainnet',
  wallet_address TEXT,
  status TEXT NOT NULL DEFAULT 'pending_provisioning'
    CHECK (status IN ('pending_provisioning', 'active', 'disabled')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_report_proxy_wallets_phone_chain
  ON public.report_proxy_wallets(phone_hash, chain_id);

CREATE INDEX IF NOT EXISTS idx_report_proxy_wallets_owner
  ON public.report_proxy_wallets(user_id, anonymous_id);

ALTER TABLE public.report_proxy_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own proxy wallets"
  ON public.report_proxy_wallets FOR SELECT
  USING (auth.uid() = user_id);

CREATE TRIGGER update_report_proxy_wallets_updated_at
  BEFORE UPDATE ON public.report_proxy_wallets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
