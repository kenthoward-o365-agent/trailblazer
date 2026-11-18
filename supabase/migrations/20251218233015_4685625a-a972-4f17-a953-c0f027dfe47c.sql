-- Phase 1: Critical Indexes (Folio & Ledger Performance)

-- folio_postings indexes (high-volume table)
CREATE INDEX IF NOT EXISTS idx_folio_postings_ledger_account ON folio_postings(ledger_account_id);
CREATE INDEX IF NOT EXISTS idx_folio_postings_account ON folio_postings(account_id);
CREATE INDEX IF NOT EXISTS idx_folio_postings_night_audit ON folio_postings(night_audit_id);
CREATE INDEX IF NOT EXISTS idx_folio_postings_created_at ON folio_postings(created_at DESC);

-- ledger_transactions index
CREATE INDEX IF NOT EXISTS idx_ledger_transactions_ledger_account ON ledger_transactions(ledger_account_id);

-- reservations indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_guest_id ON reservations(guest_id);
CREATE INDEX IF NOT EXISTS idx_reservations_property_status ON reservations(property_id, status);

-- Phase 2: Property-Scoped Foreign Keys (RLS performance)

CREATE INDEX IF NOT EXISTS idx_add_ons_property ON add_ons(property_id);
CREATE INDEX IF NOT EXISTS idx_account_groups_property ON account_groups(property_id);
CREATE INDEX IF NOT EXISTS idx_account_taxes_property ON account_taxes(property_id);
CREATE INDEX IF NOT EXISTS idx_site_types_property ON site_types(property_id);
CREATE INDEX IF NOT EXISTS idx_seasons_property ON seasons(property_id);
CREATE INDEX IF NOT EXISTS idx_night_audits_property ON night_audits(property_id);
CREATE INDEX IF NOT EXISTS idx_rate_rules_property ON rate_rules(property_id);

-- Phase 3: Related Entity Lookups

-- Rate add-ons indexes
CREATE INDEX IF NOT EXISTS idx_rate_add_ons_rate ON rate_add_ons(rate_id);
CREATE INDEX IF NOT EXISTS idx_rate_add_ons_add_on ON rate_add_ons(add_on_id);

-- City ledger and invoicing indexes
CREATE INDEX IF NOT EXISTS idx_city_ledger_invoices_reservation ON city_ledger_invoices(reservation_id);
CREATE INDEX IF NOT EXISTS idx_group_blocks_city_ledger ON group_blocks(city_ledger_account_id);

-- Group block indexes
CREATE INDEX IF NOT EXISTS idx_group_block_allocations_block ON group_block_room_allocations(group_block_id);
CREATE INDEX IF NOT EXISTS idx_group_block_allocations_site ON group_block_room_allocations(site_id);
CREATE INDEX IF NOT EXISTS idx_group_block_payment_cards_block ON group_block_payment_cards(group_block_id);

-- Reservation add-ons
CREATE INDEX IF NOT EXISTS idx_reservation_add_ons_add_on ON reservation_add_ons(add_on_id);