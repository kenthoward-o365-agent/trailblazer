
CREATE INDEX IF NOT EXISTS idx_folio_postings_account_date
  ON public.folio_postings (ledger_account_id, posting_date DESC);

CREATE INDEX IF NOT EXISTS idx_folio_postings_account_id
  ON public.folio_postings (account_id) WHERE account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reservations_prop_dates
  ON public.reservations (property_id, check_in_date, check_out_date)
  WHERE status IN ('PENDING','CONFIRMED','CHECKED_IN');

CREATE INDEX IF NOT EXISTS idx_reservations_site_dates
  ON public.reservations (site_id, check_in_date, check_out_date)
  WHERE site_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sites_prop_type_active
  ON public.sites (property_id, site_type_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_ledger_tx_account_date
  ON public.ledger_transactions (ledger_account_id, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_booking_holds_site_dates
  ON public.booking_holds (site_id, check_in, check_out) WHERE site_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_booking_holds_expires
  ON public.booking_holds (expires_at);
