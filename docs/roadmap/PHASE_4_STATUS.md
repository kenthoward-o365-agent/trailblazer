# Phase 4 — Enterprise Finance & Ops (shipped)

Phase 4 rounds out the enterprise portfolio platform with consolidated accounting, cross-park operations, and executive reporting. It builds on Phase 1's hierarchy, Phase 2's memberships, and Phase 3's rate templates and portfolio yield rollup.

## What's live

### 1. Consolidated accounting
- **`intercompany_transfers`** — move funds between two properties in the same organization. Fields: from/to property, amount, currency, memo, reference, status (`pending` → `posted` → `reversed`), posted_at, posted_by. Org admins post and reverse. UI at `/admin/intercompany-transfers`.
- **`consolidated_ar_customers`** + **`consolidated_ar_links`** — corporate accounts (fleet, government, film crews) that touch multiple parks, each linked to a per-property `ledger_accounts` row. UI at `/admin/consolidated-ar` for org admins to spin up an account and toggle which parks it can post against.
- **`gl_export_schedules`** — per-property schedule (QuickBooks / NetSuite / Sage / Dynamics / CSV) with cadence and `next_run_at`. Foundation for scheduled GL exports; the existing QuickBooks sync becomes one target.

### 2. Regional Ops
- **`regional_work_order_pool`** — routes work orders across parks in a region with SLA and travel-minute hints. Statuses: `queued`, `dispatched`, `in_progress`, `completed`, `cancelled`. Regional managers add open work orders from any park in the region and progress them through the flow. UI at `/admin/regional-ops`.

### 3. Executive reporting + warehouse export
- **`executive_report_snapshots`** — org/brand/region/property KPI snapshots stored as JSONB (`total_revenue`, `room_revenue`, `ancillary_revenue`, `occupancy_pct`, `adr`, `revpar`, `sites_sold`, `sites_available`, `active_members`) with unique `(organization_id, brand_id, region_id, property_id, period_start, period_end, scope)`.
- Function **`compute_executive_snapshot(org_id, brand_id, region_id, period_start, period_end)`** aggregates the Phase 3 `portfolio_metrics_daily` rollup plus active membership counts and upserts a snapshot.
- **Edge function `executive-report-run`** — HTTP wrapper around the RPC.
- **Edge function `warehouse-export`** — takes `{ property_id, from_date, to_date, tables? }` and returns a JSONL-ready manifest for `reservations`, `folio_postings`, `payment_transactions`, and `portfolio_metrics_daily`. Meant as the foundation for customer-owned bucket sync (Snowflake / BigQuery / Redshift). Enforces user RLS by using the caller's JWT.
- **UI:** `/admin/executive-reports` — pick org/brand/region + date range, run a snapshot, browse recent snapshots.

### 4. Access model
- Super admins manage everything. Org admins manage intercompany transfers, consolidated AR, and executive snapshots inside their organization. Brand admins inherit that scope for their brand. Regional managers manage the regional work-order pool for their region. Property staff read GL export schedules and executive snapshots scoped to their properties.

## Navigation
Admin sub-nav order is now:
Enterprise Hierarchy · Memberships · Rate Templates · Portfolio Yield · Channel Governance · **Intercompany Transfers · Consolidated AR · Regional Ops · Executive Reports**.

## Follow-ups still open

- **Actual GL export dispatch** — `gl_export_schedules` and QuickBooks sync exist separately; a scheduler job needs to read the schedule table and enqueue exports per target.
- **Intercompany posting to ledgers** — on `post`, we currently only flip the status. The double-entry postings against `ledger_accounts` on both sides still need to be written (mirroring the existing `folio_postings` pattern).
- **Consolidated AR aging view** — table + links exist; a cross-park aging report and combined statement PDF are the next UI steps.
- **Warehouse export → customer bucket** — the edge function returns a manifest; the S3/GCS put step and Parquet conversion are open (recommend Fivetran connector as an alternative per roadmap).
- **Multi-currency** — currency lives on `intercompany_transfers` but portfolio metrics assume a single currency. Add per-brand FX conversion when the first Canadian portfolio ships.
- **Regional work-order pool → work_orders sync** — currently we track dispatch status separately; wire it to update `work_orders.assigned_to_user_id` and `status` when the pool item moves.

Phase 4 puts the finance + ops surface in place so the platform can answer procurement questions about consolidated books, cross-park ops routing, and executive-level portfolio reporting. What remains is dispatching real GL exports and writing the intercompany double-entry — both are follow-ups against a stable schema.
