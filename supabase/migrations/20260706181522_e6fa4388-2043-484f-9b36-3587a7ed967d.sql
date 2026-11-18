ALTER TABLE public.pos_items 
  ADD COLUMN IF NOT EXISTS revenue_ledger_account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS tax_profile_id uuid REFERENCES public.account_taxes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pos_items_revenue_account ON public.pos_items(revenue_ledger_account_id);
CREATE INDEX IF NOT EXISTS idx_pos_items_tax_profile ON public.pos_items(tax_profile_id);