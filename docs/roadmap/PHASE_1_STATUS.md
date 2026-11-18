# Phase 1 — Enterprise Foundations (shipped)

## What's live

### 1. Brand & Region hierarchy
- Tables: `brands`, `regions`. `properties.brand_id` and `properties.region_id`.
- Roles: `brand_admin`, `regional_manager` (enum values added).
- Scoping tables: `user_brand_access`, `user_region_access`.
- Helpers: `user_has_brand_access`, `user_has_region_access`, `user_has_org_admin_access`.
- `user_can_access_property` extended to grant access via brand or region scope.
- Admin UI: **Admin → Enterprise Hierarchy** (`/admin/enterprise`) — Super/Org Admins manage Brands, Regions, and Property assignments.

### 2. Central Guest & Household foundation
- Tables: `households` (org-scoped LTV/stay rollup), `guest_identities` (email/phone/external_id dedupe keys).
- `guests.household_id` and `guests.master_guest_id` (survivor link after merge).
- Merge tooling UI is deferred to a follow-up ticket — schema is in place so backfill and merge scripts can start.

### 3. Enterprise SSO (SAML)
- **Not a code change** — configured per organization via Lovable Cloud's SAML SSO setup. When an enterprise customer is ready to onboard, run the SAML config flow with their IdP metadata URL and email domains. Just-in-time role mapping from IdP groups → `user_brand_access` / `user_region_access` is a follow-up mapping layer.

### 4. Central Reservations Office (CRO)
- Page: **Central Reservations** (`/central-reservations`).
- Cross-park search filtered by Brand + Region, checks live availability from `sites`, `site_types`, and overlapping `reservations`.
- One-click deep link into each park's public booking engine with the searched dates pre-filled.

## Next follow-ups (still Phase 1 hardening)

- Backfill households from existing guests (dedupe by email/phone, insert into `guest_identities`).
- Guest merge/split UI.
- CRO agent booking flow (currently deep-links to public booking; a native "book on behalf" flow is a bigger piece).
- IdP group → role mapping table for SSO JIT provisioning.
- Add Brand + Region filter chips to reports and dashboards (Phase 3 revenue reporting will consume this).
