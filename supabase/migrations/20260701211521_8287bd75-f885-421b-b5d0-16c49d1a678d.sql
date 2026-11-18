
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS contract_start_date date,
  ADD COLUMN IF NOT EXISTS contract_end_date date,
  ADD COLUMN IF NOT EXISTS hubspot_deal_id text,
  ADD COLUMN IF NOT EXISTS hubspot_last_synced_at timestamptz;

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS hubspot_company_id text;
