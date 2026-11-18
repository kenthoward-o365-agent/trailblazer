-- Phase A: Add missing indexes on foreign keys and hot query paths
-- Safe to run: only adds indexes, no data or schema changes to columns.

-- === Composite indexes for slow queries flagged by pg_stat_statements ===
CREATE INDEX IF NOT EXISTS idx_folio_postings_property_date
  ON public.folio_postings (property_id, posting_date DESC);

CREATE INDEX IF NOT EXISTS idx_ledger_transactions_property_date
  ON public.ledger_transactions (property_id, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_ledger_transactions_account_id
  ON public.ledger_transactions (account_id);

CREATE INDEX IF NOT EXISTS idx_ledger_accounts_property_type_active_opened
  ON public.ledger_accounts (property_id, ledger_type, is_active, opened_at DESC);

-- === Missing property_id indexes (tenant-scoped children) ===
CREATE INDEX IF NOT EXISTS idx_packages_property_id                 ON public.packages (property_id);
CREATE INDEX IF NOT EXISTS idx_pos_categories_property_id           ON public.pos_categories (property_id);
CREATE INDEX IF NOT EXISTS idx_pos_outlets_property_id              ON public.pos_outlets (property_id);
CREATE INDEX IF NOT EXISTS idx_pos_order_items_property_id          ON public.pos_order_items (property_id);
CREATE INDEX IF NOT EXISTS idx_pos_inventory_movements_property_id  ON public.pos_inventory_movements (property_id);
CREATE INDEX IF NOT EXISTS idx_deposit_policies_property_id         ON public.deposit_policies (property_id);
CREATE INDEX IF NOT EXISTS idx_los_discount_rules_property_id       ON public.los_discount_rules (property_id);
CREATE INDEX IF NOT EXISTS idx_rate_booking_config_property_id      ON public.rate_booking_config (property_id);
CREATE INDEX IF NOT EXISTS idx_site_booking_config_property_id      ON public.site_booking_config (property_id);
CREATE INDEX IF NOT EXISTS idx_site_type_booking_config_property_id ON public.site_type_booking_config (property_id);
CREATE INDEX IF NOT EXISTS idx_work_order_comments_property_id      ON public.work_order_comments (property_id);
CREATE INDEX IF NOT EXISTS idx_work_order_attachments_property_id   ON public.work_order_attachments (property_id);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_property_id      ON public.security_audit_logs (property_id);
CREATE INDEX IF NOT EXISTS idx_statement_sends_property_id          ON public.statement_sends (property_id);

-- === POS relationship indexes (hot for order flow) ===
CREATE INDEX IF NOT EXISTS idx_pos_items_category_id                ON public.pos_items (category_id);
CREATE INDEX IF NOT EXISTS idx_pos_order_items_variant_id           ON public.pos_order_items (variant_id);
CREATE INDEX IF NOT EXISTS idx_pos_order_items_revenue_account      ON public.pos_order_items (revenue_ledger_account_id);
CREATE INDEX IF NOT EXISTS idx_pos_orders_reservation_id            ON public.pos_orders (reservation_id);
CREATE INDEX IF NOT EXISTS idx_pos_orders_outlet_id                 ON public.pos_orders (outlet_id);
CREATE INDEX IF NOT EXISTS idx_pos_orders_folio_posting_id          ON public.pos_orders (folio_posting_id);
CREATE INDEX IF NOT EXISTS idx_pos_orders_payment_tx_id             ON public.pos_orders (payment_transaction_id);
CREATE INDEX IF NOT EXISTS idx_pos_inventory_movements_outlet_id    ON public.pos_inventory_movements (outlet_id);
CREATE INDEX IF NOT EXISTS idx_pos_inventory_movements_variant_id   ON public.pos_inventory_movements (variant_id);
CREATE INDEX IF NOT EXISTS idx_pos_categories_revenue_account       ON public.pos_categories (revenue_ledger_account_id);
CREATE INDEX IF NOT EXISTS idx_pos_outlets_cash_account             ON public.pos_outlets (cash_ledger_account_id);
CREATE INDEX IF NOT EXISTS idx_pos_outlets_clearing_account         ON public.pos_outlets (clearing_ledger_account_id);
CREATE INDEX IF NOT EXISTS idx_pos_outlets_default_revenue_account  ON public.pos_outlets (default_revenue_ledger_account_id);

-- === Booking engine hot path ===
CREATE INDEX IF NOT EXISTS idx_booking_holds_rate_id                ON public.booking_holds (rate_id);
CREATE INDEX IF NOT EXISTS idx_booking_holds_site_type_id           ON public.booking_holds (site_type_id);
CREATE INDEX IF NOT EXISTS idx_booking_holds_expires_at             ON public.booking_holds (expires_at);

-- === Rate configuration lookups ===
CREATE INDEX IF NOT EXISTS idx_package_items_package_id             ON public.package_items (package_id);
CREATE INDEX IF NOT EXISTS idx_package_items_add_on_id              ON public.package_items (add_on_id);
CREATE INDEX IF NOT EXISTS idx_rate_site_type_prices_site_type_id   ON public.rate_site_type_prices (site_type_id);
CREATE INDEX IF NOT EXISTS idx_rate_booking_config_deposit_policy   ON public.rate_booking_config (deposit_policy_id);

-- === Reservation-linked children (heavy on ReservationEdit / booking chart) ===
CREATE INDEX IF NOT EXISTS idx_reservations_property_status_dates
  ON public.reservations (property_id, status, check_in_date, check_out_date);
CREATE INDEX IF NOT EXISTS idx_reservations_guest_id                ON public.reservations (guest_id);
CREATE INDEX IF NOT EXISTS idx_reservations_site_id                 ON public.reservations (site_id);
CREATE INDEX IF NOT EXISTS idx_reservations_rate_id                 ON public.reservations (rate_id);

-- === Guest lookups ===
CREATE INDEX IF NOT EXISTS idx_guests_favorite_site_id              ON public.guests (favorite_site_id);
CREATE INDEX IF NOT EXISTS idx_guests_email                         ON public.guests (lower(email)) WHERE email IS NOT NULL;

-- === Audit / admin / integrations ===
CREATE INDEX IF NOT EXISTS idx_admin_access_audit_org_id            ON public.admin_access_audit (organization_id);
CREATE INDEX IF NOT EXISTS idx_accounting_integrations_connected_by ON public.accounting_integrations (connected_by);
CREATE INDEX IF NOT EXISTS idx_accounting_sync_log_synced_by        ON public.accounting_sync_log (synced_by);
CREATE INDEX IF NOT EXISTS idx_api_keys_created_by                  ON public.api_keys (created_by);
CREATE INDEX IF NOT EXISTS idx_property_groups_organization_id      ON public.property_groups (organization_id);
CREATE INDEX IF NOT EXISTS idx_staff_activity_log_staff_id          ON public.staff_activity_log (staff_id);
CREATE INDEX IF NOT EXISTS idx_statement_sends_city_ledger_account  ON public.statement_sends (city_ledger_account_id);
CREATE INDEX IF NOT EXISTS idx_user_custom_roles_custom_role_id     ON public.user_custom_roles (custom_role_id);

-- Refresh planner stats so new indexes are considered immediately
ANALYZE public.folio_postings;
ANALYZE public.ledger_transactions;
ANALYZE public.ledger_accounts;
ANALYZE public.reservations;
ANALYZE public.booking_holds;
ANALYZE public.pos_orders;