-- =====================================================
-- Database Optimization Migration
-- Removes duplicate indexes and optimizes for production
-- =====================================================

-- PHASE 1: Remove Duplicate Indexes
-- Each pair has the same index definition on the same column(s)

-- reservations table
DROP INDEX IF EXISTS idx_reservations_rate_id;
DROP INDEX IF EXISTS idx_reservations_guest_id;
DROP INDEX IF EXISTS idx_reservations_site_type_id;

-- ledger_accounts table
DROP INDEX IF EXISTS idx_ledger_accounts_reservation_guest_id;

-- reservation_guests table
DROP INDEX IF EXISTS idx_reservation_guests_reservation_id;
DROP INDEX IF EXISTS idx_reservation_guests_guest_id;

-- sites table
DROP INDEX IF EXISTS idx_sites_type;

-- ledger_transactions table
DROP INDEX IF EXISTS idx_ledger_transactions_account;

-- group_block_room_allocations table
DROP INDEX IF EXISTS idx_group_block_allocations_site;
DROP INDEX IF EXISTS idx_group_block_allocations_block;

-- payment_cards table
DROP INDEX IF EXISTS idx_payment_cards_reservation_guest_id;

-- guests table
DROP INDEX IF EXISTS idx_guests_origin_property_id;
DROP INDEX IF EXISTS idx_guests_organization_id;

-- folio_postings table
DROP INDEX IF EXISTS idx_folio_postings_source_posting_id;

-- campaigns table
DROP INDEX IF EXISTS idx_campaigns_property_id;

-- campaign_sends table
DROP INDEX IF EXISTS idx_campaign_sends_campaign_id;
DROP INDEX IF EXISTS idx_campaign_sends_guest_id;

-- api_keys and api_logs tables
DROP INDEX IF EXISTS idx_api_keys_property_id;
DROP INDEX IF EXISTS idx_api_logs_property_id;
DROP INDEX IF EXISTS idx_api_logs_api_key_id;

-- folio_split_rules table
DROP INDEX IF EXISTS idx_folio_split_rules_reservation_id;

-- folio_split_rule_allocations table
DROP INDEX IF EXISTS idx_folio_split_rule_allocations_split_rule_id;

-- journal_entry_lines table
DROP INDEX IF EXISTS idx_journal_entry_lines_entry;

-- city_ledger_invoice_payments table
DROP INDEX IF EXISTS idx_city_ledger_invoice_payments_invoice;

-- group_block_payment_cards table
DROP INDEX IF EXISTS idx_group_block_payment_cards_block;

-- guest_sharing_group_members table
DROP INDEX IF EXISTS idx_guest_sharing_group_members_property;

-- rates table
DROP INDEX IF EXISTS idx_rates_revenue_account_id;

-- reservation_add_ons table
DROP INDEX IF EXISTS idx_reservation_add_ons_add_on;

-- user_property_access table
DROP INDEX IF EXISTS idx_user_property_access_org;

-- night_audit_settings table (unique constraint covers this)
DROP INDEX IF EXISTS idx_night_audit_settings_property;

-- staff_profiles table (unique constraint covers this)
DROP INDEX IF EXISTS idx_staff_profiles_user;

-- cleaning_preferences table (unique constraint covers this)
DROP INDEX IF EXISTS idx_cleaning_preferences_property;

-- PHASE 2: Add Optimized Composite Indexes for Common Queries
-- These improve performance for the most common query patterns

-- Reservation lookups by property and status (very common)
CREATE INDEX IF NOT EXISTS idx_reservations_property_status 
ON reservations(property_id, status);

-- Folio postings by date (for reports)
CREATE INDEX IF NOT EXISTS idx_folio_postings_created_at 
ON folio_postings(created_at DESC);

-- Ledger accounts active lookup (for guest ledger, city ledger)
CREATE INDEX IF NOT EXISTS idx_ledger_accounts_active_type 
ON ledger_accounts(is_active, ledger_type) 
WHERE is_active = true;

-- Sites by property and housekeeping status (common for housekeeping dashboard)
CREATE INDEX IF NOT EXISTS idx_sites_property_housekeeping 
ON sites(property_id, housekeeping_status);

-- Sites by property and occupancy status (common for availability checks)
CREATE INDEX IF NOT EXISTS idx_sites_property_occupancy 
ON sites(property_id, occupancy_status);

-- Reservations date range queries (tape chart, reports)
CREATE INDEX IF NOT EXISTS idx_reservations_dates 
ON reservations(property_id, check_in_date, check_out_date);

-- PHASE 3: Update Statistics
ANALYZE;