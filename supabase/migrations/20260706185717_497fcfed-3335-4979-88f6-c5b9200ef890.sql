ALTER TABLE public.pos_categories
  DROP CONSTRAINT IF EXISTS pos_categories_revenue_ledger_account_id_fkey,
  DROP CONSTRAINT IF EXISTS pos_categories_tax_profile_id_fkey;

ALTER TABLE public.pos_categories
  ADD CONSTRAINT pos_categories_revenue_ledger_account_id_fkey
  FOREIGN KEY (revenue_ledger_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;

ALTER TABLE public.pos_categories DROP COLUMN IF EXISTS tax_profile_id;