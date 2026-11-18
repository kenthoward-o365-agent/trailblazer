# Phase 3 — Portfolio Revenue & Distribution (shipped)

Phase 3 answers the "how do we run rates and channels across 400 parks?" side of the enterprise RFP. It builds on Phase 1's brand/region hierarchy and Phase 2's membership engine.

## What's live

### 1. Rate templates + bulk push
Tables: `rate_templates`, `rate_template_site_type_prices`, `rate_template_restrictions`, `rate_template_pushes`.

- Templates are scoped **organization / brand / region** with `template_code`, `name`, `description`, deposit requirement, and adjustment type/value.
- Per site-type pricing is keyed by `site_type_code` so a single template can push into any property that defines matching site type codes.
- Restrictions per template hold `start_date`, `end_date`, `min_los`, `max_los`, `cta`, `ctd`, `stop_sell`.
- Push audit log records `pushed_by`, target property IDs, status, and a JSON `result_summary`.
- RLS: super admin, org admin, and brand admin can manage; regional managers and property staff can read templates within their scope.

**Edge function `rate-template-push`** (JWT-verified) — takes `{ template_id, property_ids[], start_date, end_date }` and, per property, upserts a `rates` row keyed by `(property_id, rate_code)`, maps template site-type codes to that property's `site_types.code`, upserts `rate_site_type_prices`, and inserts `rate_rules` restriction rows referencing the new rate. Returns a per-property success/error report and writes an audit row in `rate_template_pushes`.

**UI:** `/admin/rate-templates` — list templates, edit prices and restrictions inline, pick eligible properties (filtered by scope) and push with a date range. Push results show per-property status.

### 2. Portfolio yield insights
Table: `portfolio_metrics_daily` (property_id + stay_date rollup) storing `sites_available`, `sites_sold`, `occupancy_pct`, `adr`, `revpar`, `room_revenue`, `ancillary_revenue`, `total_revenue`.

Function `refresh_portfolio_metrics(_property_id, _from, _to)` rebuilds the rollup by scanning `reservations` (revenue prorated across nights) and `reservation_add_ons`.

**Edge function `portfolio-metrics-refresh`** (service role) — takes `{ property_ids[], from_date, to_date }` and loops the RPC. Wire to night audit or run on demand.

**UI:** `/admin/portfolio-yield` — filter by brand, region, date range. Shows KPIs (revenue, avg occupancy, ADR, RevPAR), per-property table, and compression alerts for parks over 85% occupancy.

### 3. Channel governance
Table: `channel_governance_policies` — one row per `(organization_id, brand_id)` with `allowed_channels` (JSONB list), `parity_enforced`, and notes.

**UI:** `/admin/channel-governance` — pick an org and optionally a brand, toggle allowed channels (Expedia, Booking.com, Airbnb, Google Hotel Ads, brand direct), enable/disable parity enforcement, save. Provides the governance surface for channel manager code to enforce brand-level policy before publishing.

## Navigation
Admin sub-nav now includes: **Enterprise Hierarchy · Memberships · Rate Templates · Portfolio Yield · Channel Governance**.

## Not yet wired (Phase 3 follow-ups)

- **Channel manager honoring governance policies** — the channel push pipelines (`channel-ari-push`, `channel-content-push`) should read `channel_governance_policies` and refuse to publish disabled channels, and warn on parity drift.
- **Night audit rollup hook** — call `portfolio-metrics-refresh` for each property at day-end close so the rollup stays fresh without manual clicks.
- **STLY comparison + pace charts** — the rollup is in place; the UI currently shows KPIs and a compression alert. Add same-time-last-year deltas and pace-to-forecast charts next.
- **Bulk restrictions calendar** — restrictions are per-template today; a calendar-style bulk editor across parks is a natural follow-up.
- **Google Hotel Ads / metasearch feed** — schema recognizes the channel; feed generator is not built.

The Phase 3 primitives (templates, push audit, yield rollup, governance policy) are in and RLS-scoped so anyone building the follow-ups can extend without schema churn.
