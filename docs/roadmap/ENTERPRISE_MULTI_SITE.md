
# Enterprise Multi-Site Roadmap

Target buyers: Equity LifeStyle Properties (Thousand Trails, Encore RV), Sun Communities, Blue Water, KOA-scale franchise groups. These operators run 80–400+ parks under 1–4 brands, sell **memberships** as much as nightly stays, and need central everything with local flexibility.

We already have the multi-tenant primitives (organizations → property groups → properties, cross-property sharing flags, org admin role). The gaps below are what turns us from "PMS with multi-property" into an **enterprise portfolio platform**.

---

## Gap analysis vs. what ELS-scale operators expect

| Area | Have today | Enterprise gap |
|---|---|---|
| Hierarchy | Org → Group → Property | No Brand / Region / District layer above properties |
| Guest profile | Per-property, sharing groups | No true central guest / household / membership record |
| Memberships | None | Core to Thousand Trails / Encore revenue model |
| Reservations | Per-property | No central reservations office (CRO) / cross-park search |
| Rates | Per-property | No corporate rate templates, bulk overrides, yield rules at portfolio scale |
| Reporting | Per-property + org roll-up flag | No warehouse, no cross-brand BI, no scheduled exec reports |
| Users | Per-property + org admin | No SSO/SAML, no regional-manager scoped roles, no bulk provisioning |
| Accounting | Per-property, shared COA | No intercompany, no consolidated AR, no enterprise GL export cadence |
| Channels | Expedia + Booking.com per property | No portfolio-level channel governance, brand.com deep-linking |
| Ops | Per-property | No central task/work-order routing, no cross-park housekeeping/maintenance pool |

---

## Phase 1 — Enterprise Foundations (unlocks the RFP)

1. **Brand & Region hierarchy above Property Group**
   - New tables: `brands` (org → brands), `regions` (brand → regions), FK on properties. Property Group becomes optional cluster inside a Region.
   - Roles: `brand_admin`, `regional_manager` scoped via `user_brand_access` / `user_region_access` (mirrors existing `user_property_access` pattern).
   - Every list/report gains Brand + Region filter chips.

2. **Central Guest & Household record**
   - Promote `guests` to org-scoped with property visibility; add `households` (family unit) and `guest_identities` (email/phone match keys).
   - Dedupe/merge tooling. LTV, stay count, revenue rolled up across the whole portfolio.
   - Consent + marketing preferences stored centrally (CAN-SPAM/CASL/GDPR scoped by brand).

3. **Enterprise SSO + Directory**
   - SAML 2.0 and OIDC (Okta, Azure AD, Google Workspace). SCIM 2.0 for user provisioning/deprovisioning.
   - Just-in-time role assignment from IdP groups → brand/region/property scopes.
   - Enterprise audit log export (SIEM-friendly JSONL to S3).

4. **Central Reservations Office (CRO) workspace**
   - Cross-park availability search by date/region/site-type/amenities.
   - Agent can quote, hold, and book at any park the agent's role permits, with source-of-business = "CRO".
   - Overflow rules: if park A sold out, suggest sister parks in same region.

---

## Phase 2 — Membership & Loyalty Engine (the ELS-specific moat)

5. **Membership programs**
   - `membership_programs` (Thousand Trails Zone Pass, Encore Adventure, KOA VKR, custom).
   - Tiers, benefits (free nights, % off, priority booking window, length-of-stay caps, park eligibility set).
   - Member accounts with dues billing, auto-renewal, upgrade/downgrade, family add-ons.
   - Points/credits ledger for stay earn + redeem.

6. **Member-aware booking & rates**
   - Rate resolver checks member tier → applies entitlement (free-with-cap, discounted, blackout).
   - Booking engine gates rate plans by verified membership; guest login required for member rates.
   - Reservations enforce entitlement rules (max consecutive nights, cool-down between stays, park-per-year caps).

7. **Membership sales at point of booking / front desk**
   - Upsell flow: "Add Zone Pass for $X and save $Y on this stay + all future stays." Signs, dues posted to member ledger.

---

## Phase 3 — Portfolio Revenue & Distribution

8. **Corporate rate templates + bulk push**
   - Define rate template at Brand/Region level → push to all child properties with per-property overrides preserved.
   - Bulk restrictions calendar (MinLOS, CTA/CTD, stop-sell) across selected parks.
   - Change preview + audit before commit.

9. **Portfolio yield & demand insights**
   - Pace vs. same-time-last-year per park, region, brand.
   - Compression alerts (region-level occupancy > threshold suggests rate lift).
   - Optional AI rate recommendations (already have `get-recommendations` function to extend).

10. **Portfolio channel governance**
    - Enable/disable Expedia/Booking.com in bulk. Enforce parity policy per brand.
    - Brand.com deep-links from booking engine per property; single search across the brand's parks.
    - Add Google Hotel Ads / Vacation Rentals feed and metasearch (Phase 3b).

---

## Phase 4 — Enterprise Finance & Ops

11. **Consolidated accounting**
    - Intercompany transfers between properties inside an org.
    - Consolidated AR / city ledger view across all parks a corporate account touches (fleet, film crews, government).
    - Scheduled GL export per entity: NetSuite, Microsoft Dynamics, Sage Intacct, QuickBooks (already have QB — extend pattern).
    - Multi-currency at brand level (Canada portfolios).

12. **Centralized Ops**
    - Regional work-order pool: dispatch a maintenance tech across multiple parks with SLA + travel time.
    - Cross-park housekeeping — extend TrailGuide items to route by region.
    - Compliance/inspection templates pushed from corporate → tracked per park.

13. **Enterprise reporting & data**
    - Nightly warehouse sync (Snowflake / BigQuery / Redshift) — customer-owned bucket, Parquet.
    - Scheduled executive PDF: revenue, occupancy, ADR, RevPAR, ancillary, membership KPIs by brand/region.
    - In-app BI: build on existing `reports-chat` — extend to portfolio scope with saved boards.

---

## Phase 5 — Trust, Scale, Procurement

14. **Security & compliance package**
    - SOC 2 Type II readiness pack (we already have MFA, audit logs, PCI SAQ A).
    - Configurable data residency (US / CA / EU) per brand.
    - Customer-managed encryption keys (BYOK) option.
    - DPA + BAA templates, published sub-processor list.

15. **Performance & reliability at 400-park scale**
    - Move heavy per-property queries to materialized roll-ups (occupancy, revenue) refreshed by night audit.
    - Read replicas / caching for CRO search.
    - Rate-limit and quota per organization on API + booking engine.

16. **Enterprise procurement surface**
    - Sandbox environment provisioning per org.
    - Public status page + uptime SLA (99.9%).
    - Open API + webhook catalog (extend existing MCP + `pos-api` + `ota-api` pattern).
    - White-label: brand-scoped domains, emails, and booking engine themes (we have brand sync — extend to full white-label per brand entity).

---

## Recommended sequencing

```text
Q1  Phase 1  Foundations (Brand/Region, Central Guest, SSO, CRO)
Q2  Phase 2  Membership engine + member-aware booking
Q3  Phase 3  Corporate rates, portfolio yield, channel governance
Q4  Phase 4  Consolidated finance, central ops, warehouse
Ongoing  Phase 5  Security, scale, procurement
```

Phase 1 alone lets us respond credibly to an ELS-style RFP. Phase 2 is what actually differentiates us from Sabre SynXis and RMS Cloud for RV/glamping portfolios — nobody serves memberships well.

---

## Open questions for you

- Which portfolio is the anchor design partner (ELS, Sun, Blue Water, KOA, other)? Their model shapes the Membership schema.
- Do we sell CRO as a seat-based add-on or bundle it?
- Do we build the warehouse sync ourselves or partner (Fivetran connector)?
- White-label depth: brand-scoped subdomain only, or full custom domain + SES-per-brand?

Say the word and I'll turn Phase 1 into a concrete build plan (schema, routes, roles, migrations) as the next step.
