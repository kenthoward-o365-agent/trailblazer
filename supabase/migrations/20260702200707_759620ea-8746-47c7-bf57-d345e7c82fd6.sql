
-- ==== Add QuickBooks account mapping to chart of accounts ====
ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS qb_account_id TEXT,
  ADD COLUMN IF NOT EXISTS qb_account_name TEXT;

-- ==== Add auto-post toggle to properties ====
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS auto_post_to_quickbooks BOOLEAN NOT NULL DEFAULT false;

-- ==== Accounting Integrations (per property, per provider) ====
CREATE TABLE IF NOT EXISTS public.accounting_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'quickbooks',
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','production')),
  realm_id TEXT,
  access_token TEXT,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  refresh_token_expires_at TIMESTAMPTZ,
  company_name TEXT,
  is_active BOOLEAN NOT NULL DEFAULT false,
  connected_at TIMESTAMPTZ,
  connected_by UUID REFERENCES auth.users(id),
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (property_id, provider)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounting_integrations TO authenticated;
GRANT ALL ON public.accounting_integrations TO service_role;

ALTER TABLE public.accounting_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users with property access can view accounting integrations"
  ON public.accounting_integrations FOR SELECT TO authenticated
  USING (public.user_has_property_access(property_id));

CREATE POLICY "Users with property access can insert accounting integrations"
  ON public.accounting_integrations FOR INSERT TO authenticated
  WITH CHECK (public.user_has_property_access(property_id));

CREATE POLICY "Users with property access can update accounting integrations"
  ON public.accounting_integrations FOR UPDATE TO authenticated
  USING (public.user_has_property_access(property_id));

CREATE POLICY "Users with property access can delete accounting integrations"
  ON public.accounting_integrations FOR DELETE TO authenticated
  USING (public.user_has_property_access(property_id));

CREATE TRIGGER update_accounting_integrations_updated_at
  BEFORE UPDATE ON public.accounting_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ==== Accounting Sync Log ====
CREATE TABLE IF NOT EXISTS public.accounting_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'quickbooks',
  dayend_close_id UUID REFERENCES public.dayend_closes(id) ON DELETE SET NULL,
  sync_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending','success','failed')),
  external_ref TEXT,
  request_payload JSONB,
  response_payload JSONB,
  error_message TEXT,
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS accounting_sync_log_property_idx
  ON public.accounting_sync_log (property_id, synced_at DESC);
CREATE INDEX IF NOT EXISTS accounting_sync_log_dayend_idx
  ON public.accounting_sync_log (dayend_close_id);

GRANT SELECT, INSERT ON public.accounting_sync_log TO authenticated;
GRANT ALL ON public.accounting_sync_log TO service_role;

ALTER TABLE public.accounting_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users with property access can view sync log"
  ON public.accounting_sync_log FOR SELECT TO authenticated
  USING (public.user_has_property_access(property_id));

CREATE POLICY "Users with property access can insert sync log"
  ON public.accounting_sync_log FOR INSERT TO authenticated
  WITH CHECK (public.user_has_property_access(property_id));
