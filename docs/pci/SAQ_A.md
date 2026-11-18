# PCI DSS SAQ A Compliance – Trailblazer PMS

This document describes how Trailblazer PMS satisfies the requirements of
**PCI DSS v4.0 SAQ A** — the shortest self-assessment questionnaire, available
only to merchants that **fully outsource** account-data functions to a validated
third-party service provider (Adyen).

## 1. Scope

| Item | Value |
| --- | --- |
| SAQ type | **SAQ A** (v4.0) |
| Payment channel | E-commerce / MOTO — card-not-present |
| PSP / TPSP | **Adyen N.V.** (Level 1 PCI DSS Service Provider) |
| Merchant PAN storage | **None** — application never receives, processes, or stores PAN |
| Card capture method | Adyen Web Drop-in (hosted iframes) via Sessions API |
| Server-initiated (MIT) | Adyen `/payments/{pspRef}/{captures,refunds,cancels}` using tokens |

## 2. Controls

### 2.1 No PAN ever touches our systems (Req 3, 4)

- The browser renders Adyen's Drop-in, which embeds Adyen-hosted iframes for
  card number, expiry, and CVC. These fields are **never inside our DOM or
  React state**.
- The Drop-in submits card data **directly to Adyen** over TLS 1.2+. Our
  origin is never in the network path for card data.
- On our backend, `supabase/functions/_shared/pci.ts` provides
  `assertNoCardData()` — every payment edge function calls it on the request
  body and hard-rejects any field named `cardNumber`, `pan`, `cvv`, `cvc`,
  `csc`, or any string of 13–19 digits.
- Logging goes through `safeLog()` / `safeError()`, which run `redact()` on the
  payload. Console output cannot contain a PAN even by accident.

### 2.2 Tokenization & server-initiated transactions (Req 3.2, 8.6)

- Card-on-file uses Adyen's `storePaymentMethodMode: "askForConsent"` with
  `recurringProcessingModel: "CardOnFile"`.
- We persist only: brand, last four digits, expiry month/year, cardholder
  name, `adyen_shopper_reference`, and `adyen_recurring_reference`.
- Later captures / refunds / cancels are done server-side by
  `process-payment` using the stored `pspReference` — no PAN is required.

### 2.3 Multi-factor authentication (Req 8.4)

- Supabase Auth is configured to support TOTP factors.
- The `payment_cards` RLS `SELECT` policy calls
  `public.current_user_has_mfa()`, which returns true only when the JWT's
  `aal` claim is `aal2`. **Users who have not completed MFA on their current
  session see zero rows** — RLS defence in depth.
- The `MfaGuard` React component wraps every UI surface that renders card
  metadata. If the session is aal1, the user is prompted to enroll or
  challenge TOTP before the resource renders.

### 2.4 Row-level authorization (Req 7)

- Write access to `payment_cards`, `payment_authorizations`, and
  `payment_transactions` is **service-role only**. All writes flow through
  edge functions that verify the Adyen result server-side.
- The only exception is `DELETE` on `payment_cards`, which admins/managers
  with MFA can perform to detokenize a card at end of retention.
- Reads are property-scoped via `user_has_property_access(property_id)`.

### 2.5 Webhook integrity (Req 11.5, 12.10)

- `supabase/functions/adyen-webhook` verifies HMAC-SHA256 on every
  `NotificationRequestItem` before mutating state. Items with missing or
  invalid signatures are dropped and logged.
- The HMAC key lives in the `ADYEN_HMAC_KEY` secret and is never returned to
  the client.

### 2.6 Secrets management (Req 3.6, 8.3.1)

| Secret | Owner | Rotation | Notes |
| --- | --- | --- | --- |
| `ADYEN_API_KEY` | Adyen CA account | 12 months, or on suspected compromise | Read only by `adyen-session` and `process-payment` |
| `ADYEN_HMAC_KEY` | Adyen CA account | 12 months | Read only by `adyen-webhook` |
| `ADYEN_MERCHANT_ACCOUNT` | Adyen CA account | Static config | |
| `ADYEN_ENVIRONMENT` | `test` or `live` | Set per environment | |
| `SUPABASE_SERVICE_ROLE_KEY` | Managed by hosting | On personnel change | Never exposed to client |

Secrets are stored in the platform secret store and injected into edge
functions as environment variables. They are never committed to git, logged,
or returned to the browser.

## 3. What we intentionally do NOT do

- We do NOT proxy card data.
- We do NOT store PAN, sensitive authentication data, or CVV — even
  transiently.
- We do NOT run a payment page on our own origin that submits card fields to
  our server.
- We do NOT log request bodies for payment endpoints without running them
  through `redact()`.
- We do NOT allow ad-hoc SQL access to `payment_cards`, `payment_transactions`,
  or `payment_authorizations` (RLS + revoked write grants).

## 4. Change control

Any PR that touches:

- `supabase/functions/adyen-*`
- `supabase/functions/process-payment/**`
- `supabase/functions/_shared/pci.ts`
- `src/components/payments/**`
- RLS policies on `payment_*` tables

must be reviewed by a PCI-aware maintainer and cannot merge without an
explicit statement that the change does not expand PCI scope.

## 5. Attestation checklist (annual)

- [ ] Adyen AoC (Attestation of Compliance) on file and current
- [ ] TLS scan (SSL Labs) of production hosts, grade ≥ A
- [ ] `grep -rE 'cardNumber|\\bpan\\b|cvv|cvc' src/ supabase/` returns only
      pci.ts / doc mentions
- [ ] `assertNoCardData()` present at the top of every payment edge function
- [ ] MFA required for all staff with access to card metadata (verify by
      querying `auth.mfa_factors`)
- [ ] Adyen HMAC key rotated within the last 12 months
- [ ] Adyen API key rotated within the last 12 months
- [ ] Personnel changes reviewed; departed staff removed from the platform

## 6. Logging redaction & retention (Phase 3)

### Log redaction
Every payment-adjacent edge function calls `installConsoleRedaction()` at
import time (see `supabase/functions/_shared/pci.ts`). This monkey-patches
`console.{log,error,warn,info,debug}` so all arguments pass through
`redact()`, which strips PAN patterns and elides `number`, `cardNumber`,
`pan`, `cvv`, `cvc`, `csc`, `track1`, `track2`, `encryptedData` keys.

Functions with redaction installed:
- `adyen-session`, `adyen-webhook`, `process-payment`, `payment-config`
- `ota-api`, `pos-api` (booking/POS endpoints that could receive a
  misbehaving integrator payload)
- `pci-retention-sweep`

### Retention windows
Enforced by `public.pci_retention_sweep()` (SECURITY DEFINER, service_role
only):

| Data                                | Retention |
| ----------------------------------- | --------- |
| `payment_authorizations` (terminal) | 13 months |
| `payment_transactions`              | 18 months |
| `api_logs`                          | 90 days   |
| `payment_cards` PII (name/expiry)   | purged after 24 months idle with no active auth |

### Schedule
`pg_cron` job `pci-retention-sweep-daily` runs at 03:15 UTC and calls
`public.pci_retention_sweep()` directly in-database (SECURITY DEFINER
scoped to the cron owner). The edge function `pci-retention-sweep`
remains available for manual audit runs and requires the service-role
key as bearer. Anon/authenticated users cannot execute the sweep RPC or
the endpoint.

## 7. MFA enforcement surface (Phase 4)

PCI DSS 8.4 requires MFA on all access to the cardholder data
environment. In the UI, `MfaGuard` (`src/components/security/MfaGuard.tsx`)
wraps every surface that can render card metadata or export guest PII:

- `PaymentCardList` — stored card summaries
- `MultiCardManager` — multi-card add/remove/select
- `AuthorizationManager` — authorize / capture / void / increase flows
- `ExportDialog` — CSV/Excel/PDF exports of reservations, guests, and
  city-ledger data (all can contain PII)

At the database layer, the `payment_cards` SELECT policy calls
`public.current_user_has_mfa()`, so even if a client were to bypass the
UI guard, RLS returns zero rows for sessions below `aal2`.

