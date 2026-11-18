ALTER TABLE public.accounting_integrations
  ADD COLUMN IF NOT EXISTS sync_frequency TEXT NOT NULL DEFAULT 'manual'
    CHECK (sync_frequency IN ('manual','on_dayend','daily','weekly'));