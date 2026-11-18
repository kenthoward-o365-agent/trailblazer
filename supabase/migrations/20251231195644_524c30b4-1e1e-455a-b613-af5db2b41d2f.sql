-- Add Missing Foreign Key Indexes for Query Performance Optimization
-- Verified columns only

-- ============================================
-- HIGH-PRIORITY TABLES
-- ============================================

-- ledger_accounts
CREATE INDEX IF NOT EXISTS idx_ledger_accounts_property ON public.ledger_accounts(property_id);
CREATE INDEX IF NOT EXISTS idx_ledger_accounts_guest ON public.ledger_accounts(guest_id);
CREATE INDEX IF NOT EXISTS idx_ledger_accounts_reservation ON public.ledger_accounts(reservation_id);
CREATE INDEX IF NOT EXISTS idx_ledger_accounts_reservation_guest ON public.ledger_accounts(reservation_guest_id);

-- folio_postings
CREATE INDEX IF NOT EXISTS idx_folio_postings_ledger_account ON public.folio_postings(ledger_account_id);
CREATE INDEX IF NOT EXISTS idx_folio_postings_transaction ON public.folio_postings(ledger_transaction_id);
CREATE INDEX IF NOT EXISTS idx_folio_postings_source_ledger ON public.folio_postings(source_ledger_account_id);
CREATE INDEX IF NOT EXISTS idx_folio_postings_account ON public.folio_postings(account_id);
CREATE INDEX IF NOT EXISTS idx_folio_postings_night_audit ON public.folio_postings(night_audit_id);
CREATE INDEX IF NOT EXISTS idx_folio_postings_source_posting ON public.folio_postings(source_posting_id);
CREATE INDEX IF NOT EXISTS idx_folio_postings_voided_posting ON public.folio_postings(voided_posting_id);

-- ledger_transactions
CREATE INDEX IF NOT EXISTS idx_ledger_transactions_ledger_account ON public.ledger_transactions(ledger_account_id);
CREATE INDEX IF NOT EXISTS idx_ledger_transactions_journal ON public.ledger_transactions(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_ledger_transactions_account ON public.ledger_transactions(account_id);

-- reservations
CREATE INDEX IF NOT EXISTS idx_reservations_property ON public.reservations(property_id);
CREATE INDEX IF NOT EXISTS idx_reservations_site ON public.reservations(site_id);
CREATE INDEX IF NOT EXISTS idx_reservations_guest ON public.reservations(guest_id);
CREATE INDEX IF NOT EXISTS idx_reservations_rate ON public.reservations(rate_id);
CREATE INDEX IF NOT EXISTS idx_reservations_source ON public.reservations(source_of_business_id);
CREATE INDEX IF NOT EXISTS idx_reservations_city_ledger ON public.reservations(city_ledger_account_id);
CREATE INDEX IF NOT EXISTS idx_reservations_group_block ON public.reservations(group_block_id);
CREATE INDEX IF NOT EXISTS idx_reservations_site_type ON public.reservations(site_type_id);
CREATE INDEX IF NOT EXISTS idx_reservations_share_group ON public.reservations(share_group_id);
CREATE INDEX IF NOT EXISTS idx_reservations_master ON public.reservations(master_reservation_id);

-- payment_transactions
CREATE INDEX IF NOT EXISTS idx_payment_transactions_card ON public.payment_transactions(payment_card_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_property ON public.payment_transactions(property_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_reservation ON public.payment_transactions(reservation_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_ledger ON public.payment_transactions(ledger_account_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_auth ON public.payment_transactions(authorization_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_posting ON public.payment_transactions(folio_posting_id);

-- payment_authorizations
CREATE INDEX IF NOT EXISTS idx_payment_authorizations_property ON public.payment_authorizations(property_id);
CREATE INDEX IF NOT EXISTS idx_payment_authorizations_ledger ON public.payment_authorizations(ledger_account_id);
CREATE INDEX IF NOT EXISTS idx_payment_authorizations_card ON public.payment_authorizations(payment_card_id);

-- payment_cards
CREATE INDEX IF NOT EXISTS idx_payment_cards_guest ON public.payment_cards(guest_id);
CREATE INDEX IF NOT EXISTS idx_payment_cards_property ON public.payment_cards(property_id);
CREATE INDEX IF NOT EXISTS idx_payment_cards_reservation ON public.payment_cards(reservation_id);
CREATE INDEX IF NOT EXISTS idx_payment_cards_reservation_guest ON public.payment_cards(reservation_guest_id);
CREATE INDEX IF NOT EXISTS idx_payment_cards_ledger_account ON public.payment_cards(ledger_account_id);

-- ============================================
-- MEDIUM-PRIORITY TABLES
-- ============================================

-- group_blocks
CREATE INDEX IF NOT EXISTS idx_group_blocks_property ON public.group_blocks(property_id);
CREATE INDEX IF NOT EXISTS idx_group_blocks_master_ledger ON public.group_blocks(master_ledger_account_id);
CREATE INDEX IF NOT EXISTS idx_group_blocks_city_ledger ON public.group_blocks(city_ledger_account_id);

-- group_block_room_allocations
CREATE INDEX IF NOT EXISTS idx_gb_allocations_group_block ON public.group_block_room_allocations(group_block_id);
CREATE INDEX IF NOT EXISTS idx_gb_allocations_rate ON public.group_block_room_allocations(rate_id);
CREATE INDEX IF NOT EXISTS idx_gb_allocations_site ON public.group_block_room_allocations(site_id);
CREATE INDEX IF NOT EXISTS idx_gb_allocations_site_type ON public.group_block_room_allocations(site_type_id);

-- group_block_payment_cards
CREATE INDEX IF NOT EXISTS idx_gb_payment_cards_group_block ON public.group_block_payment_cards(group_block_id);
CREATE INDEX IF NOT EXISTS idx_gb_payment_cards_card ON public.group_block_payment_cards(payment_card_id);

-- campaign_sends
CREATE INDEX IF NOT EXISTS idx_campaign_sends_campaign ON public.campaign_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sends_guest ON public.campaign_sends(guest_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sends_reservation ON public.campaign_sends(reservation_id);

-- city_ledger_invoices
CREATE INDEX IF NOT EXISTS idx_city_ledger_invoices_account ON public.city_ledger_invoices(city_ledger_account_id);
CREATE INDEX IF NOT EXISTS idx_city_ledger_invoices_property ON public.city_ledger_invoices(property_id);
CREATE INDEX IF NOT EXISTS idx_city_ledger_invoices_reservation ON public.city_ledger_invoices(reservation_id);
CREATE INDEX IF NOT EXISTS idx_city_ledger_invoices_source_folio ON public.city_ledger_invoices(source_folio_id);

-- city_ledger_invoice_payments
CREATE INDEX IF NOT EXISTS idx_city_ledger_payments_invoice ON public.city_ledger_invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_city_ledger_payments_transaction ON public.city_ledger_invoice_payments(payment_transaction_id);

-- housekeeping_assignments
CREATE INDEX IF NOT EXISTS idx_housekeeping_assignments_property ON public.housekeeping_assignments(property_id);
CREATE INDEX IF NOT EXISTS idx_housekeeping_assignments_site ON public.housekeeping_assignments(site_id);
CREATE INDEX IF NOT EXISTS idx_housekeeping_assignments_staff ON public.housekeeping_assignments(staff_id);

-- dayend_closes
CREATE INDEX IF NOT EXISTS idx_dayend_closes_property ON public.dayend_closes(property_id);
CREATE INDEX IF NOT EXISTS idx_dayend_closes_night_audit ON public.dayend_closes(night_audit_id);

-- journal_entries
CREATE INDEX IF NOT EXISTS idx_journal_entries_property ON public.journal_entries(property_id);

-- journal_entry_lines
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_journal ON public.journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account ON public.journal_entry_lines(account_id);

-- reservation_guests
CREATE INDEX IF NOT EXISTS idx_reservation_guests_reservation ON public.reservation_guests(reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservation_guests_guest ON public.reservation_guests(guest_id);

-- folio_split_rules
CREATE INDEX IF NOT EXISTS idx_folio_split_rules_reservation ON public.folio_split_rules(reservation_id);
CREATE INDEX IF NOT EXISTS idx_folio_split_rules_account ON public.folio_split_rules(account_id);

-- folio_split_rule_allocations
CREATE INDEX IF NOT EXISTS idx_folio_split_allocations_rule ON public.folio_split_rule_allocations(split_rule_id);
CREATE INDEX IF NOT EXISTS idx_folio_split_allocations_guest ON public.folio_split_rule_allocations(reservation_guest_id);

-- ============================================
-- LOWER-PRIORITY TABLES
-- ============================================

-- sites
CREATE INDEX IF NOT EXISTS idx_sites_property ON public.sites(property_id);
CREATE INDEX IF NOT EXISTS idx_sites_site_type ON public.sites(site_type_id);
CREATE INDEX IF NOT EXISTS idx_sites_zone ON public.sites(zone_id);
CREATE INDEX IF NOT EXISTS idx_sites_connecting_room ON public.sites(connecting_room_id);

-- rates (verified columns)
CREATE INDEX IF NOT EXISTS idx_rates_property ON public.rates(property_id);
CREATE INDEX IF NOT EXISTS idx_rates_base_rate ON public.rates(base_rate_id);
CREATE INDEX IF NOT EXISTS idx_rates_revenue_account ON public.rates(revenue_account_id);

-- rate_seasons
CREATE INDEX IF NOT EXISTS idx_rate_seasons_rate ON public.rate_seasons(rate_id);

-- add_ons
CREATE INDEX IF NOT EXISTS idx_add_ons_property ON public.add_ons(property_id);
CREATE INDEX IF NOT EXISTS idx_add_ons_account ON public.add_ons(account_id);

-- account_taxes
CREATE INDEX IF NOT EXISTS idx_account_taxes_property ON public.account_taxes(property_id);
CREATE INDEX IF NOT EXISTS idx_account_taxes_revenue ON public.account_taxes(revenue_account_id);
CREATE INDEX IF NOT EXISTS idx_account_taxes_tax ON public.account_taxes(tax_account_id);
CREATE INDEX IF NOT EXISTS idx_account_taxes_inclusive ON public.account_taxes(inclusive_of_tax_id);

-- accounts
CREATE INDEX IF NOT EXISTS idx_accounts_property ON public.accounts(property_id);
CREATE INDEX IF NOT EXISTS idx_accounts_group ON public.accounts(account_group_id);

-- account_groups
CREATE INDEX IF NOT EXISTS idx_account_groups_property ON public.account_groups(property_id);

-- api_keys
CREATE INDEX IF NOT EXISTS idx_api_keys_property ON public.api_keys(property_id);

-- api_logs
CREATE INDEX IF NOT EXISTS idx_api_logs_api_key ON public.api_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_logs_property ON public.api_logs(property_id);

-- auto_run_logs
CREATE INDEX IF NOT EXISTS idx_auto_run_logs_property ON public.auto_run_logs(property_id);

-- campaigns
CREATE INDEX IF NOT EXISTS idx_campaigns_property ON public.campaigns(property_id);

-- cleaning_preferences
CREATE INDEX IF NOT EXISTS idx_cleaning_preferences_property ON public.cleaning_preferences(property_id);

-- custom_roles
CREATE INDEX IF NOT EXISTS idx_custom_roles_property ON public.custom_roles(property_id);

-- guarantee_options
CREATE INDEX IF NOT EXISTS idx_guarantee_options_property ON public.guarantee_options(property_id);

-- guest_room_preferences
CREATE INDEX IF NOT EXISTS idx_guest_room_preferences_guest ON public.guest_room_preferences(guest_id);

-- guest_sharing_group_members
CREATE INDEX IF NOT EXISTS idx_guest_sharing_members_group ON public.guest_sharing_group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_guest_sharing_members_property ON public.guest_sharing_group_members(property_id);

-- guest_sharing_groups
CREATE INDEX IF NOT EXISTS idx_guest_sharing_groups_organization ON public.guest_sharing_groups(organization_id);

-- guests
CREATE INDEX IF NOT EXISTS idx_guests_organization ON public.guests(organization_id);
CREATE INDEX IF NOT EXISTS idx_guests_origin_property ON public.guests(origin_property_id);

-- housekeeping_staff
CREATE INDEX IF NOT EXISTS idx_housekeeping_staff_property ON public.housekeeping_staff(property_id);

-- housekeeping_zones
CREATE INDEX IF NOT EXISTS idx_housekeeping_zones_property ON public.housekeeping_zones(property_id);

-- login_attempts
CREATE INDEX IF NOT EXISTS idx_login_attempts_user ON public.login_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_login_attempts_property ON public.login_attempts(property_id);

-- night_audits
CREATE INDEX IF NOT EXISTS idx_night_audits_property ON public.night_audits(property_id);

-- night_audit_settings
CREATE INDEX IF NOT EXISTS idx_night_audit_settings_property ON public.night_audit_settings(property_id);

-- ota_connections
CREATE INDEX IF NOT EXISTS idx_ota_connections_property ON public.ota_connections(property_id);

-- properties
CREATE INDEX IF NOT EXISTS idx_properties_organization ON public.properties(organization_id);

-- property_confirmation_sequences
CREATE INDEX IF NOT EXISTS idx_property_confirmation_sequences_property ON public.property_confirmation_sequences(property_id);

-- reservation_add_ons
CREATE INDEX IF NOT EXISTS idx_reservation_add_ons_reservation ON public.reservation_add_ons(reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservation_add_ons_addon ON public.reservation_add_ons(add_on_id);

-- reservation_recommendations
CREATE INDEX IF NOT EXISTS idx_reservation_recommendations_reservation ON public.reservation_recommendations(reservation_id);

-- site_types
CREATE INDEX IF NOT EXISTS idx_site_types_property ON public.site_types(property_id);

-- source_of_business
CREATE INDEX IF NOT EXISTS idx_source_of_business_property ON public.source_of_business(property_id);

-- staff_profiles
CREATE INDEX IF NOT EXISTS idx_staff_profiles_user ON public.staff_profiles(user_id);

-- user_property_access
CREATE INDEX IF NOT EXISTS idx_user_property_access_user ON public.user_property_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_property_access_property ON public.user_property_access(property_id);
CREATE INDEX IF NOT EXISTS idx_user_property_access_organization ON public.user_property_access(organization_id);

-- user_roles
CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles(user_id);