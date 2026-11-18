
-- Phase H: Add missing composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_change_journal_property_created
  ON public.change_journal (property_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_logs_property_created
  ON public.api_logs (property_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_transactions_property_created
  ON public.payment_transactions (property_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_access_audit_property_created
  ON public.admin_access_audit (property_id, created_at DESC);

-- Drop redundant duplicate indexes (identical column set already covered by another index)
-- reservations: guest_id, rate_id, site_id, master_reservation_id duplicated
DROP INDEX IF EXISTS public.idx_reservations_guest_id;   -- covered by idx_reservations_guest
DROP INDEX IF EXISTS public.idx_reservations_rate_id;    -- covered by idx_reservations_rate
DROP INDEX IF EXISTS public.idx_reservations_site_id;    -- covered by idx_reservations_site
DROP INDEX IF EXISTS public.idx_reservations_master;     -- covered by partial idx_reservations_master_reservation

-- ledger_transactions: property_date duplicated
DROP INDEX IF EXISTS public.idx_ledger_transactions_property_date; -- covered by idx_ledger_tx_property_date

-- folio_postings: account_id duplicated (full vs partial-non-null - partial covers all real lookups)
DROP INDEX IF EXISTS public.idx_folio_postings_account; -- covered by partial idx_folio_postings_account_id
