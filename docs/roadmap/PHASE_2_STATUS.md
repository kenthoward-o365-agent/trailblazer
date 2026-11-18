# Phase 2 — Membership & Loyalty Engine (shipped)

## What's live

### 1. Schema
Tables: `membership_programs`, `membership_tiers`, `membership_program_properties`,
`member_accounts`, `member_dues_invoices`, `member_points_ledger`, `member_entitlement_usage`,
`rate_membership_eligibility`.

- Programs are org-scoped and configurable: `billing_period` (monthly/quarterly/annual/lifetime),
  `dues_amount`, `currency`, `auto_renew_default`, and points earn/redeem economics.
- Tiers stack under a program with priority, discount %, free-nights-per-year cap,
  max consecutive nights, cooldown, park-per-year cap, points multiplier, and JSON blackout dates.
- Park eligibility can be program-wide or restricted to specific tiers.
- Member numbers auto-generate as `M` + 9 digits (unique per org).
- `member_points_ledger` inserts sync `member_accounts.points_balance` via trigger.
- `get_active_memberships_for_property(guest_id, property_id)` helper for the rate resolver.

### 2. Admin UI
**Admin → Memberships** (`/admin/memberships`) — tabs for Programs, Tiers & Benefits,
Park Eligibility, and Members. Super/Org Admins configure programs, tiers, and which parks
honor each program from one screen.

### 3. Membership verification (Both identity paths)
Edge function **`membership-verify`** takes `{member_number, last_name, property_id?}` and
returns `{verified, program, tier, discount_percent, points_balance}`. Used by:
- Public booking engine — anonymous guests can enter member # + last name to unlock member rates.
- Logged-in guests — automatic lookup via `guests.id`.
- Front desk — staff verify walk-ins.

Client hook: `useMembershipVerify()` in `src/hooks/useMembershipVerify.ts`.

### 4. Adyen recurring dues
Edge function **`membership-dues-run`** scans `member_accounts` for auto-renew members
within 3 days of expiration, creates a `member_dues_invoices` row, and charges the stored
Adyen token (`shopperReference` + `storedPaymentMethodId`) via `/payments` with
`shopperInteraction=ContAuth` and `recurringProcessingModel=Subscription`. On success the
membership `expires_at` extends by the program's billing period. Zero raw card data — PCI SAQ A.

Wire to a cron schedule (e.g. daily at 03:00) with `pg_cron` + `pg_net` when the customer is ready to enable dues billing.

## Follow-ups still open in Phase 2

- **Booking engine rate resolver wiring** — the schema, hook, and eligibility table are in place.
  The public booking search page still needs a "member #" input and to apply `discount_percent`
  before quote calculation. The tables `rate_membership_eligibility` gate which rates are member-only.
- **Member enrollment flow** — front-desk "sell a membership" wizard that tokenizes a card
  via Adyen Drop-in and stores `adyen_shopper_reference` + `adyen_recurring_detail_reference`
  on `member_accounts`.
- **Guest self-service** — a `/my-memberships` page showing dues history, points ledger, and auto-renew toggle.
- **Points earning on stay** — a night-audit hook that inserts a `member_points_ledger` row for
  each checked-out reservation using the program's `points_per_currency_unit` × stay revenue × tier multiplier.
- **Entitlement caps enforcement** — reservation create should call
  `get_active_memberships_for_property` and reject if it violates `max_consecutive_nights`,
  `cooldown_days`, or `parks_per_year_cap`.

These are all incremental — the foundation, verify path, and dues billing pipeline are shipped.
