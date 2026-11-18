# Trailblazer PMS — Engineering Handoff
**Audience:** Incoming development team  **Prepared:** November 17, 2026  **Product:** Trailblazer (by DockMaster), campground / RV resort / glamping property management system

This document explains what the system is, how it is built, and exactly what you must do to move it from the Lovable-managed GitHub repository and Lovable Cloud backend into your own repository, infrastructure and tool chain, while keeping every feature (including the AI features) working.

---

## 1. Executive summary

| Area | Current state |
|---|---|
| Frontend | React 18 + TypeScript 5 single-page app, Vite 5, Tailwind CSS 3, shadcn/ui (Radix), TanStack Query 5, React Router 6 |
| Backend | Supabase (Postgres 15, Auth, Storage, Edge Functions on Deno, pg_cron, pg_net), hosted by Lovable Cloud |
| Database | ~150 tables in `public`, 190 migrations, ~50 SQL functions (≈67 SECURITY DEFINER usages), RLS on every table |
| Server logic | 47 Deno edge functions (plus `_shared`) in `supabase/functions/` |
| AI | Lovable AI Gateway (OpenAI-compatible) using `google/gemini-2.5-flash`, `google/gemini-3-flash-preview`, `openai/gpt-4o-transcribe` |
| Payments | Adyen Drop-in (PCI SAQ A — no card data touches our servers) |
| Integrations | Adyen, Twilio (SMS), Resend (email), QuickBooks Online, HubSpot, Expedia & Booking.com (channel manager, adapters currently mocked), Firecrawl, MCP server |
| Tenancy | Organization → Brand → Region → Property; strict `property_id` isolation |

---

## 2. Getting the code into your own repository

The project is two-way synced to a private GitHub repo created by Lovable under `kenthoward-o365-agent`. Lovable pushes to the default branch (`main`).

### 2.1 Clone and re-home
```bash
git clone https://github.com/kenthoward-o365-agent/<lovable-created-repo>.git trailblazer
cd trailblazer
git remote rename origin lovable
git remote add origin git@github.com:<your-org>/trailblazer.git
git push -u origin main --tags
```
Keep the `lovable` remote read-only until cut-over. **Freeze edits in Lovable** at cut-over, or pull the last Lovable commit before switching; after cut-over, disconnect Git sync in Lovable (Project settings → Git).

### 2.2 What is in the repo / what is NOT
| In repo | NOT in repo (must be migrated separately) |
|---|---|
| All frontend source (`src/`) | Database **data** (rows) |
| `supabase/migrations/*.sql` (schema, RLS, functions, triggers) | Auth users & password hashes |
| `supabase/functions/*` (edge functions) | Storage bucket files (maps, logos, gallery images, KB docs) |
| `supabase/config.toml` (per-function `verify_jwt`) | Secrets (API keys — see §9) |
| `docs/` (module docs, PCI, roadmap, marketing) | pg_cron jobs created at runtime (see §6.4) |
| `.asset.json` pointers for CDN images | The binary images behind those pointers (download them — §2.4) |

### 2.3 Repository layout
```text
src/
  App.tsx                 Route table (≈90 routes: staff app, /admin, public booking /b/:slug)
  main.tsx                Bootstraps React, QueryClient, providers
  pages/                  One file per screen (Reservations, FolioReview, DayendClose, ...)
  pages/admin/            Super-admin / enterprise console (hierarchy, memberships, yield, compliance...)
  pages/public/           Booking engine (search, checkout, confirmation, manage, my-trip, online check-in), status, trust
  components/<domain>/    Feature components (accounting, booking, channel-manager, trailguide, payments, pos...)
  components/ui/          shadcn/ui primitives
  contexts/               PropertyContext (active property + audit date), Auth, Brand
  hooks/                  Data hooks wrapping Supabase queries via TanStack Query
  integrations/supabase/  client.ts + generated types.ts (regenerate, never hand edit)
  lib/                    Pure utilities (tax math, date/audit-date helpers, formatting)
supabase/
  migrations/             Ordered SQL — the schema source of truth
  functions/<name>/       Deno edge functions; _shared/ holds auth, CORS, AI helpers
  config.toml             Function auth config
docs/                     Domain docs (modules/01..14, DATABASE_DOCUMENTATION.md, pci/SAQ_A.md)
```

### 2.4 Assets
Images uploaded during development are stored on the Lovable CDN and referenced by `src/assets/*.asset.json` pointers (e.g. the "Trailblazer by DockMaster" logos). Before cut-over, download each URL in those JSON files into `src/assets/` and replace imports with normal Vite image imports. Until then they keep working but depend on Lovable's CDN.

---

## 3. Tech stack in detail

### 3.1 Frontend
- **React 18.3 / TypeScript 5 / Vite 5** (`npm run dev`, `npm run build` → `dist/`, static hosting anywhere: Vercel, Netlify, S3+CloudFront, Azure Static Web Apps).
- **Styling:** Tailwind 3 with semantic HSL tokens in `src/index.css` ("Emerald Prestige": deep emerald + aged gold, light/dark via `next-themes`). Do not hard-code colors.
- **UI kit:** shadcn/ui on Radix primitives, `lucide-react` icons, `sonner` toasts, `recharts` charts, `cmdk`, `embla-carousel`.
- **Data:** `@supabase/supabase-js` v2 + `@tanstack/react-query` v5 (cache keys always include `property_id`).
- **Forms:** `react-hook-form` + `zod`.
- **Documents:** `jspdf` + `jspdf-autotable` (folios, statements, registration cards), `exceljs`/`papaparse` (exports/imports), `pdfjs-dist` + `mammoth` (KB document ingestion), TipTap (rich-text email/campaign editor), `dompurify` (sanitizing HTML).
- **Dates:** `date-fns` + `date-fns-tz` — all operational logic uses the property **audit date** and property timezone, never the browser clock.
- **Payments UI:** `@adyen/adyen-web` v6 Drop-in.
- **MCP:** `@lovable.dev/mcp-js` + `supabase/functions/mcp` expose an MCP server (optional; replaceable by `@modelcontextprotocol/sdk`).

### 3.2 Backend (Supabase)
- **Postgres 15** with extensions: `pgcrypto`, `pg_cron`, `pg_net`, `uuid-ossp` (verify with `select * from pg_extension`).
- **Auth:** email/password + TOTP MFA (mandatory for financial data/exports), Google OAuth, password expiry/strength, inactivity timeout (client), OAuth consent page for MCP clients.
- **Storage buckets:** campground maps (private, served via signed URLs), booking engine gallery/branding, knowledge-base documents, logos. Re-create buckets and policies, then copy objects.
- **Edge functions:** Deno 1.x, `supabase functions deploy`. Shared code in `supabase/functions/_shared`.

---

## 4. Architecture

```text
 Browser (staff SPA, admin console, public booking engine /b/:slug)
     |  supabase-js (JWT)            |  fetch (anon / guest session token)
     v                               v
 PostgREST + RLS  <----------->  Edge Functions (Deno)  ---> Adyen, Twilio, Resend,
     |                               |                       QuickBooks, HubSpot,
     v                               v                       Expedia, Booking.com,
 Postgres (public schema, RLS,   AI Gateway (chat, tools,    Firecrawl
 triggers, SECURITY DEFINER fns) transcription)
     ^
     |  pg_cron + pg_net (scheduler secret)
     +-- auto-dayend-close, channel ARI push / reservation pull, trailguide dispatcher,
         campaigns, membership dues, portfolio metrics, executive reports, PCI sweep, hold cleanup
```

**Principles you must preserve**
1. **Multi-tenant isolation:** every query filters `.eq("property_id", id)` explicitly *and* RLS enforces `user_can_access_property(property_id)`. Child tables get `property_id` auto-populated by `set_*_property_id` triggers.
2. **Audit date, not calendar date:** each property has an operational `audit_date`; check-ins, postings, reports and the booking engine use it. Day-End Close (manual or automatic) advances it.
3. **Double-entry accounting:** three ledgers (advance deposit, guest, city), chart of accounts per property, every posting has an explicit account code (never defaulted). `update_ledger_balance` keeps balances in sync.
4. **Checkout safety:** checkout re-fetches balance from the DB and requires $0.
5. **PCI SAQ A:** raw PAN/CVV never enters our code, logs or DB. Only Adyen tokens/last4.

### 4.1 Tenancy hierarchy
`organizations` → `brands` → `regions` → `properties`, plus `property_groups` for shared accounts/guest sharing. Helpers: `is_super_admin`, `is_org_admin`, `user_has_brand_access`, `user_has_region_access`, `user_has_property_access`, `user_can_access_property`.

### 4.2 Main modules (frontend route → purpose)
| Route(s) | Module |
|---|---|
| `/`, `/reservations`, `/reservation/edit`, `/booking-chart`, `/central-reservations` | Reservations, tape chart, CRS |
| `/check-in`, `/in-park-guests`, `/guest-history`, `/guests` | Front desk, guest profiles (LTV, matching, sharing) |
| `/map`, `/map-editor`, `/rentals`, `/settings/site-types` | Visual campground map, sites, rentals |
| `/rates` | Base/derived rates, seasons, bundled add-ons |
| `/accounting`, `/dayend-close` | CoA, ledgers, city ledger AR, transfers, night audit / Auto Day-End |
| `/group-blocks` | Group blocks, master accounts |
| `/crm`, `/messaging` | Campaigns, two-way SMS/email with AI agent |
| `/reports`, `/reports/trailguide-items`, `/reports/change-journal` | Reports, AI report chat, TrailGuide jobs |
| `/site-turnover/work-orders`, `/pos` | Work orders, POS |
| `/settings/channel-manager` | Expedia / Booking.com mapping, hold-backs, content |
| `/knowledge-base`, `/onboarding-agent` | KB + AI onboarding agent |
| `/admin/*` | Internal/enterprise console |
| `/b/:slug/*`, `/book`, `/status`, `/trust` | Public booking engine & trust pages |

---

## 5. Data model

Full per-table column listing is in **Appendix A**. Key conventions:
- **Primary keys:** `id uuid DEFAULT gen_random_uuid()` on every table. Natural keys are unique constraints, not PKs (e.g. `reservations.confirmation_number` via `generate_confirmation_number()`, `work_orders.number`, `member_number`, `pos_orders.number`, `properties.booking_public_slug`).
- **Foreign keys:** `property_id → properties.id` on tenant data; `reservation_id`, `guest_id`, `site_id`, `folio_id`, `account_id` link operational data. User references are plain `uuid` to `auth.users.id` (only `staff_profiles`/`user_roles` FK to `auth.users` with cascade).
- **Enums:** `app_role (admin, manager, front_desk)`, `reservation_status`, `account_type`, `ledger_type (advance_deposit, guest, city)`, `transaction_type`, `wo_status/priority/category/cost_type`, `channel_code (expedia, bookingcom)`, `channel_status`, `channel_holdback_type`, `channel_queue_status`, `membership_*`. (Some legacy hotel enums like `housekeeping_status` remain but are unused — product is campground-only.)
- **Core entity relationships**
```text
organizations 1─* properties 1─* sites *─1 site_types
properties 1─* reservations *─1 guests ; reservations 1─* reservation_guests, reservation_add_ons
reservations 1─* folios 1─* folio_postings ─> chart_of_accounts
ledger_transactions / journal_entries 1─* journal_entry_lines (double entry)
properties 1─* rates 1─* rate_site_type_prices ; seasons ; add_ons
properties 1─* channel_connections 1─* channel_site_mappings / channel_rate_mappings / channel_holdbacks
channel_ari_queue, channel_sync_logs
trailguide_items 1─* trailguide_item_runs
membership_plans 1─* membership_accounts 1─* membership_dues / member_points
```

### 5.1 Migrating the database
1. Create your Supabase project (or self-hosted Supabase). Run `supabase db push` with the repo's migrations **or**, safer, take a schema dump from the live DB (migrations created runtime cron jobs/data outside files).
2. Export data: Lovable → More → Database → Manage → Settings → Export data (or `pg_dump --data-only` if granted a connection). Load in FK order with triggers disabled (`SET session_replication_role = replica`).
3. **Auth users:** export `auth.users` + `auth.identities` to keep password hashes (requires DB-level export); otherwise users must reset passwords. MFA factors (`auth.mfa_factors`) must be moved too or users re-enroll.
4. Copy storage objects bucket-by-bucket.
5. Regenerate types: `supabase gen types typescript --project-id <id> > src/integrations/supabase/types.ts`.
6. Update `.env`: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`.

**Moving off Supabase entirely?** You would need to replace PostgREST+RLS (e.g. with an API layer enforcing the same property checks), Supabase Auth (MFA, OAuth), Storage (signed URLs) and Edge Functions (port Deno → Node; code is mostly fetch-based and portable). Estimate this as a major project; staying on Supabase is strongly recommended for phase 1.

---

## 6. Security layer

### 6.1 Authentication & roles
- Supabase Auth JWTs. Roles stored in `user_roles` (never in user metadata) and checked via `has_role()`. Customer roles: `admin`, `manager`, `front_desk`, plus **custom roles** with JSONB permission grids. Internal staff roles (super admin, support) are separate tables/functions (`is_super_admin`).
- Per-user property access (`user_property_access`), organization admins, brand/region scoped roles.
- **Admin Access / support mode:** internal staff impersonation is audited (`AdminAccessAudit`).
- **MFA:** TOTP mandatory before financial data and exports (`current_user_has_mfa()` used in RLS/UI gates).
- Password expiry & change-password flow; inactivity warning/logout.
- Guest-facing booking pages use a signed guest session token (`GUEST_SESSION_SECRET`).

### 6.2 Row-Level Security
RLS is enabled on every public table. Pattern: `USING (user_can_access_property(property_id))`, admin-only writes via `has_role(auth.uid(),'admin')`. SECURITY DEFINER functions have `SET search_path = public` and **EXECUTE revoked from `anon`/`public`** where not needed (security fix of Sept 2026 — keep this).

### 6.3 Edge function security
- Functions with `verify_jwt = false` in `config.toml` (public or webhook/scheduler): `booking-engine-public`, `ota-api`, `pos-api`, `payment-config`, `adyen-webhook`, `quickbooks-oauth`, `membership-verify`, `get-recommendations`, `send-statement`, `process-campaigns`, `auto-dayend-close`, `pci-retention-sweep`, `channel-ari-push`, `channel-reservations-pull`, `membership-dues-run`, `portfolio-metrics-refresh`, `executive-report-run`. Each does its own check:
  - **Scheduler jobs** require header secret `CRON_SCHEDULER_SECRET` (or service role).
  - **User-invoked** functions validate the JWT then call `user_can_access_property`.
  - **Webhooks:** Adyen HMAC (`ADYEN_HMAC_KEY`), Twilio signature (`TWILIO_AUTH_TOKEN`).
  - **Partner APIs** (`pos-api`, `ota-api`): property-scoped hashed API keys (`api_keys` table) with quotas.
- **PCI:** `docs/pci/SAQ_A.md`; log redaction; `pci-retention-sweep` purges aged sensitive metadata.
- Compliance center: data residency, BYOK settings, retention (some items are configuration-only — see Phase 5 status doc).

### 6.4 Scheduled jobs (pg_cron → pg_net → edge function)
Re-create these in the new project (inspect `select jobname, schedule, command from cron.job;` on the current DB first — several were created at runtime, not in migrations):
| Job | Cadence | Target |
|---|---|---|
| cleanup-expired-booking-holds | every 5 min | SQL `cleanup_expired_booking_holds()` |
| auto-dayend-close | hourly | `auto-dayend-close` (closes a day only after it has ended in property local time) |
| channel ARI push | every 1 min | `channel-ari-push` |
| channel reservation pull | every 2 min | `channel-reservations-pull` |
| TrailGuide dispatcher | every few min | `trailguide-item-dispatcher` |
| campaigns | periodic | `process-campaigns` |
| membership dues / portfolio metrics / executive reports / PCI sweep | daily/periodic | respective functions |

Each job sends the `CRON_SCHEDULER_SECRET` header; update URLs to the new project.

---

## 7. Booking engine

- Public, unauthenticated SPA at `/b/:slug` (search → hold → checkout → confirmation; manage booking; guest login; My Trip; online check-in). Subdomain/slug routing per property; branding & CSS per property (`booking-engine-brand-sync`, AI `booking-engine-css-assistant`).
- All data via the `booking-engine-public` edge function (service role inside, strict input validation, property resolved from slug). Never query tables directly from the public pages.
- **Holds:** time-boxed inventory holds, cleaned every 5 min. Availability respects site types, unit-required vs floating inventory, hold-backs for channels, rental availability (`get_rental_availability`), and the property audit date.
- **Payments:** `adyen-session` creates Drop-in sessions; `adyen-webhook` confirms; `payment-config` returns public client config; payment guarantee rules (card guarantee) enforced.
- Gallery & campground map images served through signed URLs (map bucket is private).
- Membership-aware pricing is partially wired (see `docs/roadmap/PHASE_3_STATUS.md`).

## 8. Application workflows worth knowing
- **Reservation lifecycle:** PENDING → CONFIRMED → CHECKED_IN → CHECKED_OUT / CANCELLED, plus reinstate. Advance deposits are mandatory-handled on cancel/no-show.
- **Folio:** charges, payments (account dropdown filtered to asset/liability), transfers between ledgers, city-ledger transfer auto-creates invoice, explicit Check Out button gated on $0 balance.
- **Day-End Close / Auto Day-End:** trial balance, room & tax posting, then policy engine for left-to-arrive (cancel / move / no-show into non-occupying hold folio with first night + tax + packages / stop) and left-to-depart (extend / check-out hold / stop), deposit disposition (hold / forfeit / stop), exceptions journal with before/after, AI summary. Code: `auto-dayend-close`, `dayend-resolve-exceptions`, `src/pages/DayendClose.tsx`.
- **Channel manager:** reservation/rate changes enqueue to `channel_ari_queue` via trigger `enqueue_channel_ari_on_reservation`; `channel-ari-push` drains it. **Expedia and Booking.com adapters are currently mocked** — implementing the real EQC/Rapid and Booking.com Connectivity APIs (and partner certification) is required work.
- **Enterprise:** CRS, memberships/points, rate templates pushed to properties (`rate-template-push`), portfolio yield, intercompany transfers, consolidated AR, regional work orders, warehouse export, white-label, status/incidents, webhook catalog.

---

## 9. Integrations & secrets

| Secret | Used by | Notes |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | all functions | auto-provided by Supabase |
| `LOVABLE_API_KEY` | all AI functions | **Replace** — see §10 |
| `CRON_SCHEDULER_SECRET` | scheduled functions | generate new random value |
| `GUEST_SESSION_SECRET` | booking engine guest sessions | new random value (invalidates existing guest sessions) |
| `ADYEN_API_KEY`, `ADYEN_MERCHANT_ACCOUNT`, `ADYEN_HMAC_KEY`, `ADYEN_ENVIRONMENT` | adyen-session/webhook, process-payment | update webhook URL in Adyen Customer Area |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_API_KEY`, `TWILIO_FROM_NUMBER` | messaging-send, twilio-webhook, TrailGuide SMS | re-point inbound webhook URL |
| `RESEND_API_KEY` | send-communication, send-folio-email, send-statement | verify sending domain |
| `QUICKBOOKS_CLIENT_ID/SECRET/REDIRECT_URI` | quickbooks-oauth/sync | update redirect URI in Intuit app |
| `HUBSPOT_API_KEY` | hubspot-sync-customer, provision webhook | |
| `EXPEDIA_USERNAME/PASSWORD`, `BOOKING_COM_USERNAME/PASSWORD` | channel adapters | needed once real adapters exist |
| `FIRECRAWL_API_KEY` | messaging-kb-import (website → KB) | |

Secret values cannot be exported from Lovable Cloud; obtain them from each vendor account and set with `supabase secrets set`.

---

## 10. AI features and the tooling to keep them running

All AI calls go through the **Lovable AI Gateway** (`https://ai.gateway.lovable.dev/v1/chat/completions` and `/v1/audio/transcriptions`), an OpenAI-compatible API authenticated with `LOVABLE_API_KEY`. **This key and gateway are tied to Lovable**, so off-platform you must swap the provider.

### 10.1 Feature inventory
| Feature | Function(s) | Model | What it does |
|---|---|---|---|
| **TrailGuide assistant** (in-app agent) | `trailguide-chat`, `trailguide-action`, `trailguide-transcribe` | gemini-2.5-flash / gemini-3-flash-preview; gpt-4o-transcribe for voice | Natural-language Q&A and actions over property data via tool calling; voice input |
| **TrailGuide Items** (scheduled jobs, Admin/Manager) | `trailguide-item-approve`, `trailguide-item-dispatcher`, `trailguide-item-run` | gemini | "Text me today's arrivals", "every Sunday 9pm send 7-day forecast": AI parses the request into a structured job (query + schedule + delivery), user approves, dispatcher runs on schedule, results via SMS/email; runs logged in Reports → TrailGuide Items |
| **Reports chat** | `reports-chat` | gemini | Ask questions of report data; uses `execute_readonly_query` (read-only, property-scoped) |
| **Guest messaging AI agent** | `messaging-ai-agent`, `messaging-execute-action`, `messaging-kb-import` | gemini | Drafts/answers guest SMS/email using property KB; proposes actions staff approve |
| **Knowledge base chat** | `kb-chat` | gemini | Answers staff "how do I" questions from the campground KB |
| **Onboarding Agent** | `OnboardingAgent.tsx` + functions | gemini | Interviews new customers and writes configuration on approval |
| **Recommendations** | `get-recommendations` | gemini | Upsell/site recommendations |
| **Day-End AI summary** | `auto-dayend-close` | gemini | Plain-language summary of exceptions |
| **Booking engine CSS assistant** | `booking-engine-css-assistant` | gemini | Generates branded CSS |
| **Executive reports** | `executive-report-run` | gemini | Narrative portfolio snapshots |
| **MCP server** | `mcp` | n/a | Exposes PMS tools to external AI clients via OAuth consent |

### 10.2 Swapping the AI provider
Because the gateway is OpenAI-compatible, the change is small:
1. Centralise in `supabase/functions/_shared/` a client with `AI_BASE_URL` + `AI_API_KEY` env vars (some functions call the URL inline — grep `ai.gateway.lovable.dev` and replace all).
2. Choose a provider: **Google AI Studio / Vertex AI** (Gemini via OpenAI-compatible endpoint `https://generativelanguage.googleapis.com/v1beta/openai/`, model names without the `google/` prefix), **OpenAI**, **Azure OpenAI**, or an **OpenRouter**-style router to keep mixed models.
3. Transcription: OpenAI `gpt-4o-transcribe` or Whisper directly.
4. Keep tool-calling (`tools` / `tool_choice`) — TrailGuide and messaging agents depend on it. Re-test each tool schema after switching; Gemini and OpenAI differ slightly in JSON schema strictness.
5. Handle 429/402 rate-limit responses (code already surfaces these to the UI).

### 10.3 Operating the AI safely
- **Guardrails already in place:** all AI reads are property-scoped; write actions require explicit human approval (TrailGuide items, messaging actions, onboarding config); `execute_readonly_query` blocks DML. Keep these.
- **Observability:** add logging of prompt/token usage per property (currently via gateway logs in Lovable — you lose this, so add your own, e.g. Langfuse, Helicone or OpenTelemetry).
- **Cost control:** per-property usage quotas (`api_quotas` concept exists for APIs; extend to AI).
- **Evaluation:** build a regression set of TrailGuide prompts (arrivals, forecast, balances, occupancy) and run on each model change.
- **Recommended tooling for the team:** Supabase CLI, Deno, Node 20+/bun, an LLM provider account, an LLM observability tool, Postman/Bruno collection for edge functions, Playwright for E2E.

---

## 11. Cut-over checklist
1. [ ] Clone repo, push to your org, set up CI (lint, typecheck `tsc --noEmit`, build, Playwright smoke).
2. [ ] Create Supabase project(s): dev / staging / prod.
3. [ ] Apply schema; diff against live DB (`supabase db diff`) to catch runtime-created objects.
4. [ ] Migrate data, auth users (with hashes + MFA factors), storage objects.
5. [ ] Set all secrets (§9) and replace `LOVABLE_API_KEY` usage with your AI provider (§10.2).
6. [ ] Deploy all 47 edge functions; confirm `config.toml` `verify_jwt` settings.
7. [ ] Recreate pg_cron jobs with new URLs and scheduler secret.
8. [ ] Re-point webhooks: Adyen, Twilio, QuickBooks redirect, HubSpot.
9. [ ] Download CDN assets referenced by `.asset.json` into the repo.
10. [ ] Host the SPA; configure booking engine subdomains/DNS and SPA fallback routing.
11. [ ] Configure Auth: site URL, redirect URLs, Google OAuth client, email templates/SMTP.
12. [ ] Smoke test: login + MFA, create reservation, check-in, post payment (Adyen test), checkout at $0, run Day-End Close, booking engine booking, TrailGuide item creation & run, SMS send/receive.
13. [ ] Disconnect Lovable Git sync; retire Lovable Cloud backend after a parallel-run window.

## 12. Known gaps / open work
- Expedia & Booking.com adapters are mocks — real API integration and certification required.
- Full SSO/SAML for enterprise, membership-aware booking pricing, automated night-audit hooks for enterprise snapshots, Phase 5 security/proxy items (see `docs/roadmap/PHASE_*_STATUS.md`).
- Legacy hotel/housekeeping tables/enums still in schema; safe to drop after verification.
- No automated test suite of note — establish one before refactoring.

## 13. Further reading in the repo
`docs/DATABASE_DOCUMENTATION.md`, `docs/modules/01–14*.md`, `docs/modules/DATABASE_BREAKDOWN.md`, `docs/POS_INTEGRATION_API.md`, `docs/USER_JOURNEYS.md`, `docs/pci/SAQ_A.md`, `docs/roadmap/*`, `docs/marketing/*`.

---
# Appendix A — Table Catalogue (auto-extracted from migrations)

All tables live in the `public` schema. Unless noted, every table has `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`, `created_at timestamptz`, and (most) `updated_at timestamptz` maintained by trigger `update_updated_at_column()`. Tenant-scoped tables carry `property_id uuid` (FK → `properties.id`) and RLS gated by `user_can_access_property(property_id)`.

> Source of truth is `supabase/migrations/*.sql` (applied in filename order). Columns added by later `ALTER TABLE` are included where detectable; regenerate with `supabase gen types` against a live DB for exact types.


## Tenancy & hierarchy


### `brand_white_label`
- **PK:** `brand_id`
- **FKs:** `brand_id`→`brands`

| Column | Type |
|---|---|
| `brand_id` | uuid |
| `custom_domain` | text |
| `sender_email` | text |
| `sender_name` | text |
| `theme_tokens` | jsonb |
| `logo_url` | text |
| `favicon_url` | text |
| `primary_color` | text |
| `accent_color` | text |
| `is_active` | boolean |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### `brands`
- **PK:** `id`
- **FKs:** `organization_id`→`organizations`

| Column | Type |
|---|---|
| `id` | uuid |
| `organization_id` | uuid |
| `name` | text |
| `code` | text |
| `slug` | text |
| `description` | text |
| `logo_url` | text |
| `primary_color` | text |
| `is_active` | boolean |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### `membership_program_properties`
- **PK:** `id`
- **FKs:** `program_id`→`membership_programs`, `property_id`→`properties`, `tier_id`→`membership_tiers`

| Column | Type |
|---|---|
| `id` | UUID |
| `program_id` | UUID |
| `property_id` | UUID |
| `tier_id` | UUID |
| `created_at` | TIMESTAMPTZ |

### `organizations`
- **PK:** `id`

| Column | Type |
|---|---|
| `id` | UUID |
| `name` | TEXT |
| `billing_email` | TEXT |
| `payment_status` | TEXT |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |
| `share_chart_of_accounts` | boolean |
| `client_number` | INTEGER |
| `hubspot_company_id` | text |
| `welcome_email_sent_at` | TIMESTAMPTZ |

### `properties`
- **PK:** `id`

| Column | Type |
|---|---|
| `id` | UUID |
| `name` | TEXT |
| `address` | TEXT |
| `timezone` | TEXT |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |
| `map_image_url` | TEXT |
| `audit_date` | date |
| `phone1` | text |
| `organization_id` | UUID |
| `customer_id` | INTEGER |
| `max_sites` | integer |
| `property_type` | property_type |
| `country` | text |
| `payment_gateway_mode` | TEXT |
| `adyen_merchant_account` | TEXT |
| `adyen_client_key` | TEXT |
| `session_timeout_minutes` | integer |
| `booking_engine_enabled` | BOOLEAN |
| `setup_step` | INT |
| `default_online_buffer` | integer |
| `auto_post_to_quickbooks` | BOOLEAN |
| `brand_id` | uuid |

### `property_confirmation_sequences`
- **PK:** `property_id`
- **FKs:** `property_id`→`properties`

| Column | Type |
|---|---|
| `property_id` | UUID |
| `last_number` | INTEGER |

### `property_groups`
- **PK:** `id`
- **FKs:** `organization_id`→`organizations`

| Column | Type |
|---|---|
| `id` | UUID |
| `organization_id` | UUID |
| `name` | TEXT |
| `share_chart_of_accounts` | BOOLEAN |
| `share_reporting` | BOOLEAN |
| `share_user_access` | BOOLEAN |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |

### `property_work_order_sequences`
- **PK:** `property_id`
- **FKs:** `property_id`→`properties`

| Column | Type |
|---|---|
| `property_id` | uuid |
| `last_number` | integer |

### `regional_work_order_pool`
- **PK:** `id`
- **FKs:** `region_id`→`regions`, `work_order_id`→`work_orders`, `property_id`→`properties`, `dispatched_to_user_id`→`auth`

| Column | Type |
|---|---|
| `id` | uuid |
| `region_id` | uuid |
| `work_order_id` | uuid |
| `property_id` | uuid |
| `dispatched_to_user_id` | uuid |
| `sla_hours` | integer |
| `travel_minutes` | integer |
| `status` | text |
| `dispatched_at` | timestamptz |
| `completed_at` | timestamptz |
| `notes` | text |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### `regions`
- **PK:** `id`
- **FKs:** `brand_id`→`brands`, `organization_id`→`organizations`

| Column | Type |
|---|---|
| `id` | uuid |
| `brand_id` | uuid |
| `organization_id` | uuid |
| `name` | text |
| `code` | text |
| `description` | text |
| `is_active` | boolean |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### `subscriptions`
- **PK:** `id`
- **FKs:** `organization_id`→`organizations`

| Column | Type |
|---|---|
| `id` | UUID |
| `organization_id` | UUID |
| `max_sites` | INTEGER |
| `billing_cycle` | TEXT |
| `price_per_site` | NUMERIC |
| `suspended_at` | TIMESTAMPTZ |
| `suspension_reason` | TEXT |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |
| `pricing_model` | text |
| `contract_start_date` | date |

### `user_brand_access`
- **PK:** `id`
- **FKs:** `user_id`→`auth`, `brand_id`→`brands`, `organization_id`→`organizations`

| Column | Type |
|---|---|
| `id` | uuid |
| `user_id` | uuid |
| `brand_id` | uuid |
| `organization_id` | uuid |
| `is_brand_admin` | boolean |
| `created_at` | timestamptz |

### `user_property_access`
- **PK:** `id`
- **FKs:** `user_id`→`auth`, `organization_id`→`organizations`, `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | UUID |
| `user_id` | UUID |
| `organization_id` | UUID |
| `property_id` | UUID |
| `is_org_admin` | BOOLEAN |
| `created_at` | TIMESTAMPTZ |

### `user_region_access`
- **PK:** `id`
- **FKs:** `user_id`→`auth`, `region_id`→`regions`, `brand_id`→`brands`, `organization_id`→`organizations`

| Column | Type |
|---|---|
| `id` | uuid |
| `user_id` | uuid |
| `region_id` | uuid |
| `brand_id` | uuid |
| `organization_id` | uuid |
| `created_at` | timestamptz |

## Identity, roles & security


### `admin_access_audit`
- **PK:** `id`
- **FKs:** `property_id`→`properties`, `organization_id`→`organizations`

| Column | Type |
|---|---|
| `id` | UUID |
| `admin_user_id` | UUID |
| `admin_user_name` | TEXT |
| `admin_role` | TEXT |
| `property_id` | UUID |
| `property_name` | TEXT |
| `organization_id` | UUID |
| `organization_name` | TEXT |
| `action` | TEXT |
| `session_id` | UUID |
| `ip_address` | TEXT |
| `user_agent` | TEXT |
| `notes` | TEXT |
| `created_at` | TIMESTAMPTZ |

### `api_keys`
- **PK:** `id`
- **FKs:** `property_id`→`properties`, `created_by`→`auth`

| Column | Type |
|---|---|
| `id` | UUID |
| `property_id` | UUID |
| `key_name` | TEXT |
| `key_hash` | TEXT |
| `key_prefix` | TEXT |
| `key_type` | TEXT |
| `scopes` | JSONB |
| `rate_limit_per_minute` | INTEGER |
| `is_active` | BOOLEAN |
| `last_used_at` | TIMESTAMP |
| `expires_at` | TIMESTAMP |
| `created_by` | UUID |
| `created_at` | TIMESTAMP |
| `revoked_at` | TIMESTAMP |

### `custom_roles`
- **PK:** `id`
- **FKs:** `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | uuid |
| `property_id` | uuid |
| `name` | text |
| `description` | text |
| `permissions` | jsonb |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### `guest_login_attempts`
- **PK:** `id`
- **FKs:** `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | uuid |
| `property_id` | uuid |
| `confirmation_number` | text |
| `ip_address` | text |
| `succeeded` | boolean |
| `attempted_at` | timestamptz |

### `housekeeping_staff`
- **PK:** `id`
- **FKs:** `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | uuid |
| `property_id` | uuid |
| `name` | text |
| `is_active` | boolean |
| `created_at` | timestamp |
| `updated_at` | timestamp |
| `max_hours` | numeric |

### `login_attempts`
- **PK:** `id`
- **FKs:** `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | uuid |
| `user_id` | uuid |
| `property_id` | uuid |
| `attempt_time` | timestamp |
| `success` | boolean |
| `ip_address` | text |
| `user_agent` | text |

### `messaging_role_visibility`
- **PK:** `id`
- **FKs:** `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | UUID |
| `property_id` | UUID |
| `role` | TEXT |
| `category` | TEXT |
| `can_view` | BOOLEAN |
| `created_at` | TIMESTAMPTZ |

### `night_audit_settings`
- **PK:** `id`
- **FKs:** `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | UUID |
| `property_id` | UUID |
| `auto_run_enabled` | BOOLEAN |
| `auto_run_time` | TIME |
| `created_at` | TIMESTAMP |
| `updated_at` | TIMESTAMP |
| `auto_advance_audit_date` | boolean |
| `deposit_action` | text |

### `night_audits`
- **PK:** `id`
- **FKs:** `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | UUID |
| `property_id` | UUID |
| `audit_date` | DATE |
| `status` | TEXT |
| `started_at` | TIMESTAMP |
| `completed_at` | TIMESTAMP |
| `started_by` | UUID |
| `completed_by` | UUID |
| `total_room_revenue` | NUMERIC |
| `total_tax_revenue` | NUMERIC |
| `total_other_revenue` | NUMERIC |
| `total_payments` | NUMERIC |
| `folios_processed` | INTEGER |
| `notes` | TEXT |
| `created_at` | TIMESTAMP |
| `updated_at` | TIMESTAMP |

### `security_audit_logs`
- **PK:** `id`
- **FKs:** `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | uuid |
| `user_id` | uuid |
| `property_id` | uuid |
| `event_type` | text |
| `event_description` | text |
| `ip_address` | text |
| `user_agent` | text |
| `metadata` | jsonb |
| `created_at` | timestamp |

### `staff_activity_log`
- **PK:** `id`
- **FKs:** `staff_id`→`staff_profiles`

| Column | Type |
|---|---|
| `id` | UUID |
| `staff_id` | UUID |
| `action` | TEXT |
| `details` | JSONB |
| `created_at` | TIMESTAMPTZ |

### `staff_profiles`
- **PK:** `id`
- **FKs:** `user_id`→`auth`

| Column | Type |
|---|---|
| `id` | UUID |
| `user_id` | UUID |
| `first_name` | TEXT |
| `last_name` | TEXT |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |
| `phone` | TEXT |

### `user_custom_roles`
- **PK:** `id`
- **FKs:** `custom_role_id`→`custom_roles`

| Column | Type |
|---|---|
| `id` | uuid |
| `user_id` | uuid |
| `custom_role_id` | uuid |
| `created_at` | timestamptz |

### `user_lockouts`
- **PK:** `id`

| Column | Type |
|---|---|
| `id` | uuid |
| `user_id` | uuid |
| `locked_at` | timestamp |
| `unlock_at` | timestamp |
| `reason` | text |
| `unlocked_by` | uuid |
| `unlocked_at` | timestamp |

### `user_password_history`
- **PK:** `id`

| Column | Type |
|---|---|
| `id` | uuid |
| `user_id` | uuid |
| `password_changed_at` | timestamp |
| `changed_by` | uuid |

### `user_roles`
- **PK:** `id`
- **FKs:** `user_id`→`auth`

| Column | Type |
|---|---|
| `id` | UUID |
| `user_id` | UUID |
| `role` | app_role |
| `created_at` | TIMESTAMPTZ |

## Sites, inventory & map


### `channel_rate_mappings`
- **PK:** `id`
- **FKs:** `channel_id`→`channels`, `property_id`→`properties`, `rate_id`→`rates`

| Column | Type |
|---|---|
| `id` | uuid |
| `channel_id` | uuid |
| `property_id` | uuid |
| `rate_id` | uuid |
| `external_rate_plan_code` | text |
| `external_rate_plan_name` | text |
| `is_active` | boolean |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### `channel_site_type_mappings`
- **PK:** `id`
- **FKs:** `channel_id`→`channels`, `property_id`→`properties`, `site_type_id`→`site_types`

| Column | Type |
|---|---|
| `id` | uuid |
| `channel_id` | uuid |
| `property_id` | uuid |
| `site_type_id` | uuid |
| `external_room_type_code` | text |
| `external_room_type_name` | text |
| `is_active` | boolean |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### `group_block_room_allocations`
- **PK:** `id`
- **FKs:** `group_block_id`→`group_blocks`, `site_type_id`→`site_types`, `site_id`→`sites`, `rate_id`→`rates`

| Column | Type |
|---|---|
| `id` | uuid |
| `group_block_id` | uuid |
| `allocation_date` | date |
| `site_type_id` | uuid |
| `site_id` | uuid |
| `rooms_blocked` | integer |
| `rate_id` | uuid |
| `override_rate` | numeric |
| `created_at` | timestamptz |
| `(site_type_id` | IS |
| `(site_type_id` | IS |

### `guest_room_preferences`
- **PK:** `id`
- **FKs:** `guest_id`→`guests`

| Column | Type |
|---|---|
| `id` | uuid |
| `guest_id` | uuid |
| `preference_type` | text |
| `preference_value` | text |
| `created_at` | timestamp |

### `rate_site_type_prices`
- **PK:** `id`
- **FKs:** `rate_id`→`rates`, `site_type_id`→`site_types`

| Column | Type |
|---|---|
| `id` | uuid |
| `rate_id` | uuid |
| `site_type_id` | uuid |
| `price` | numeric |
| `adjustment_type` | text |
| `adjustment_value` | numeric |
| `created_at` | timestamptz |
| `property_id` | uuid |

### `rate_template_site_type_prices`
- **PK:** `id`
- **FKs:** `template_id`→`rate_templates`

| Column | Type |
|---|---|
| `id` | uuid |
| `template_id` | uuid |
| `site_type_code` | text |
| `price` | numeric(10,2) |
| `adjustment_type` | text |
| `adjustment_value` | numeric |
| `created_at` | timestamptz |

### `rental_items`
- **PK:** `id`
- **FKs:** `property_id`→`properties`, `revenue_account_id`→`ledger_accounts`

| Column | Type |
|---|---|
| `id` | UUID |
| `property_id` | UUID |
| `name` | TEXT |
| `code` | TEXT |
| `description` | TEXT |
| `category` | TEXT |
| `tracking_mode` | TEXT |
| `total_quantity` | INTEGER |
| `hourly_rate` | NUMERIC(10,2) |
| `daily_rate` | NUMERIC(10,2) |
| `stay_rate` | NUMERIC(10,2) |
| `deposit_amount` | NUMERIC(10,2) |
| `revenue_account_id` | UUID |
| `image_url` | TEXT |
| `is_active` | BOOLEAN |
| `messaging_offerable` | BOOLEAN |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |

### `rental_reservations`
- **PK:** `id`
- **FKs:** `property_id`→`properties`, `rental_item_id`→`rental_items`, `rental_unit_id`→`rental_units`, `reservation_id`→`reservations`, `guest_id`→`guests`, `folio_posting_id`→`folio_postings`

| Column | Type |
|---|---|
| `id` | UUID |
| `property_id` | UUID |
| `rental_item_id` | UUID |
| `rental_unit_id` | UUID |
| `reservation_id` | UUID |
| `guest_id` | UUID |
| `quantity` | INTEGER |
| `start_at` | TIMESTAMPTZ |
| `end_at` | TIMESTAMPTZ |
| `pricing_mode` | TEXT |
| `rate_applied` | NUMERIC(10,2) |
| `total_charge` | NUMERIC(10,2) |
| `deposit_charged` | NUMERIC(10,2) |
| `source` | TEXT |
| `status` | TEXT |
| `folio_posting_id` | UUID |
| `notes` | TEXT |
| `returned_at` | TIMESTAMPTZ |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |

### `rental_units`
- **PK:** `id`
- **FKs:** `rental_item_id`→`rental_items`, `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | UUID |
| `rental_item_id` | UUID |
| `property_id` | UUID |
| `unit_label` | TEXT |
| `asset_tag` | TEXT |
| `status` | TEXT |
| `notes` | TEXT |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |

### `room_type_cleaning_times`
- **PK:** `id`
- **FKs:** `site_type_id`→`site_types`

| Column | Type |
|---|---|
| `id` | uuid |
| `site_type_id` | uuid |
| `stayover_minutes` | integer |
| `departure_minutes` | integer |
| `created_at` | timestamp |
| `updated_at` | timestamp |

### `site_booking_config`
- **PK:** `id`
- **FKs:** `property_id`→`properties`, `site_id`→`sites`

| Column | Type |
|---|---|
| `id` | UUID |
| `property_id` | UUID |
| `site_id` | UUID |
| `is_bookable_online` | BOOLEAN |
| `is_featured` | BOOLEAN |
| `amenities` | JSONB |
| `max_rig_length` | INTEGER |
| `public_notes` | TEXT |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |

### `site_custom_attributes`
- **PK:** `id`
- **FKs:** `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | uuid |
| `property_id` | uuid |
| `name` | text |
| `code` | text |
| `data_type` | text |
| `enforce_on_booking` | boolean |
| `sort_order` | integer |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### `site_type_booking_config`
- **PK:** `id`
- **FKs:** `property_id`→`properties`, `site_type_id`→`site_types`

| Column | Type |
|---|---|
| `id` | UUID |
| `property_id` | UUID |
| `site_type_id` | UUID |
| `is_bookable_online` | BOOLEAN |
| `public_description` | TEXT |
| `allow_specific_site_pick` | BOOLEAN |
| `min_nights` | INTEGER |
| `max_nights` | INTEGER |
| `max_rig_length` | INTEGER |
| `amenities` | JSONB |
| `sort_order` | INTEGER |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |
| `online_buffer` | integer |

### `site_types`
- **PK:** `id`
- **FKs:** `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | UUID |
| `property_id` | UUID |
| `name` | TEXT |
| `base_price` | DECIMAL(10,2) |
| `description` | TEXT |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |
| `icon` | TEXT |
| `code` | VARCHAR |
| `room_class` | TEXT |
| `bed_type` | TEXT |
| `smoking_preference` | TEXT |
| `floor_size_sqft` | INTEGER |
| `max_adults` | INTEGER |
| `max_children` | INTEGER |
| `is_wheelchair_accessible` | BOOLEAN |
| `featured_amenities` | TEXT[] |
| `room_views` | TEXT[] |
| `image_path` | text |
| `auto_description` | text |

### `sites`
- **PK:** `id`
- **FKs:** `property_id`→`properties`, `site_type_id`→`site_types`

| Column | Type |
|---|---|
| `id` | UUID |
| `property_id` | UUID |
| `site_type_id` | UUID |
| `site_number` | TEXT |
| `map_x` | DECIMAL(10,4) |
| `map_y` | DECIMAL(10,4) |
| `max_occupancy` | INTEGER |
| `amenities` | TEXT[] |
| `is_active` | BOOLEAN |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |
| `max_vehicle_length` | INTEGER |
| `description` | TEXT |
| `site_access_type` | TEXT |
| `rotation` | integer |
| `map_width` | numeric |
| `slideouts` | integer |
| `maintenance_status` | text |
| `floor` | text |
| `is_shaded` | boolean |

## Reservations & guests


### `booking_engine_settings`
- **PK:** `id`
- **FKs:** `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | UUID |
| `property_id` | UUID |
| `tagline` | TEXT |
| `about_markdown` | TEXT |
| `hero_image_path` | TEXT |
| `logo_image_path` | TEXT |
| `primary_color` | TEXT |
| `contact_email` | TEXT |
| `contact_phone` | TEXT |
| `social_facebook` | TEXT |
| `social_instagram` | TEXT |
| `social_website` | TEXT |
| `min_advance_days` | INTEGER |
| `max_advance_days` | INTEGER |
| `min_nights` | INTEGER |
| `max_nights` | INTEGER |
| `same_day_cutoff_time` | TIME |
| `terms_and_conditions` | TEXT |
| `cancellation_summary` | TEXT |
| `allow_search_engine_indexing` | BOOLEAN |
| `confirmation_message` | TEXT |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |
| `accent_color` | text |
| `custom_css` | TEXT |
| `background_image_path` | text |

### `booking_holds`
- **PK:** `id`
- **FKs:** `property_id`→`properties`, `site_type_id`→`site_types`, `site_id`→`sites`, `rate_id`→`rates`

| Column | Type |
|---|---|
| `id` | UUID |
| `property_id` | UUID |
| `site_type_id` | UUID |
| `site_id` | UUID |
| `rate_id` | UUID |
| `guests` | INTEGER |
| `expires_at` | TIMESTAMPTZ |
| `session_id` | TEXT |
| `created_at` | TIMESTAMPTZ |

### `channel_holdback_rules`
- **PK:** `id`
- **FKs:** `channel_id`→`channels`, `property_id`→`properties`, `site_type_id`→`site_types`

| Column | Type |
|---|---|
| `id` | uuid |
| `channel_id` | uuid |
| `property_id` | uuid |
| `name` | text |
| `site_type_id` | uuid |
| `start_date` | date |
| `end_date` | date |
| `hold_type` | public.channel_holdback_type |
| `hold_value` | integer |
| `priority` | integer |
| `is_active` | boolean |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### `channel_reservations_inbox`
- **PK:** `id`
- **FKs:** `channel_id`→`channels`, `property_id`→`properties`, `reservation_id`→`reservations`

| Column | Type |
|---|---|
| `id` | uuid |
| `channel_id` | uuid |
| `property_id` | uuid |
| `external_reservation_id` | text |
| `payload` | jsonb |
| `status` | text |
| `reservation_id` | uuid |
| `processed_at` | timestamptz |
| `last_error` | text |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### `group_block_payment_cards`
- **PK:** `id`
- **FKs:** `group_block_id`→`group_blocks`, `payment_card_id`→`payment_cards`

| Column | Type |
|---|---|
| `id` | uuid |
| `group_block_id` | uuid |
| `payment_card_id` | uuid |
| `is_primary` | boolean |
| `created_at` | timestamptz |

### `group_blocks`
- **PK:** `id`
- **FKs:** `property_id`→`properties`, `master_ledger_account_id`→`ledger_accounts`

| Column | Type |
|---|---|
| `id` | uuid |
| `property_id` | uuid |
| `code` | varchar(6) |
| `description` | text |
| `--` | Address |
| `street_address` | text |
| `city` | text |
| `state` | text |
| `zipcode` | text |
| `country` | text |
| `--` | Contact |
| `contact_first_name` | text |
| `contact_last_name` | text |
| `contact_email` | text |
| `contact_phone` | text |
| `--` | Date |
| `start_date` | date |
| `end_date` | date |
| `--` | Settings |
| `allow_other_room_types` | boolean |
| `allow_overbooking` | boolean |
| `--` | Master |
| `has_master_account` | boolean |
| `master_contact_name` | text |
| `master_contact_email` | text |
| `master_contact_phone` | text |
| `charge_routing` | text |
| `master_ledger_account_id` | uuid |
| `--` | Status |
| `status` | text |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |
| `city_ledger_account_id` | UUID |

### `guest_identities`
- **PK:** `id`
- **FKs:** `organization_id`→`organizations`, `guest_id`→`guests`

| Column | Type |
|---|---|
| `id` | uuid |
| `organization_id` | uuid |
| `guest_id` | uuid |
| `identity_type` | text |
| `identity_value` | text |
| `is_verified` | boolean |
| `created_at` | timestamptz |

### `guest_sharing_group_members`
- **PK:** `id`
- **FKs:** `group_id`→`guest_sharing_groups`, `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | UUID |
| `group_id` | UUID |
| `property_id` | UUID |
| `created_at` | TIMESTAMP |

### `guest_sharing_groups`
- **PK:** `id`
- **FKs:** `organization_id`→`organizations`

| Column | Type |
|---|---|
| `id` | UUID |
| `organization_id` | UUID |
| `name` | TEXT |
| `created_at` | TIMESTAMP |
| `updated_at` | TIMESTAMP |

### `guests`
- **PK:** `id`

| Column | Type |
|---|---|
| `id` | UUID |
| `email` | TEXT |
| `first_name` | TEXT |
| `last_name` | TEXT |
| `phone` | TEXT |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |
| `title` | text |
| `birthday` | date |
| `organization_id` | UUID |
| `country` | text |
| `favorite_site_id` | uuid |
| `household_id` | uuid |

### `households`
- **PK:** `id`
- **FKs:** `organization_id`→`organizations`

| Column | Type |
|---|---|
| `id` | uuid |
| `organization_id` | uuid |
| `name` | text |
| `primary_email` | text |
| `primary_phone` | text |
| `address_line1` | text |
| `address_line2` | text |
| `city` | text |
| `state_region` | text |
| `postal_code` | text |
| `country` | text |
| `ltv_amount` | numeric(12,2) |
| `stay_count` | integer |
| `marketing_opt_in` | boolean |
| `notes` | text |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### `rate_booking_config`
- **PK:** `id`
- **FKs:** `property_id`→`properties`, `rate_id`→`rates`, `deposit_policy_id`→`deposit_policies`

| Column | Type |
|---|---|
| `id` | UUID |
| `property_id` | UUID |
| `rate_id` | UUID |
| `is_public` | BOOLEAN |
| `public_name` | TEXT |
| `public_description` | TEXT |
| `deposit_policy_id` | UUID |
| `payment_mode_override` | TEXT |
| `sort_order` | INTEGER |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |

### `reservation_add_ons`
- **PK:** `id`
- **FKs:** `reservation_id`→`reservations`, `add_on_id`→`add_ons`

| Column | Type |
|---|---|
| `id` | UUID |
| `reservation_id` | UUID |
| `add_on_id` | UUID |
| `quantity` | INTEGER |
| `price_at_booking` | DECIMAL(10,2) |
| `created_at` | TIMESTAMPTZ |
| `property_id` | uuid |

### `reservation_guests`
- **PK:** `id`
- **FKs:** `reservation_id`→`reservations`, `guest_id`→`guests`

| Column | Type |
|---|---|
| `id` | UUID |
| `reservation_id` | UUID |
| `guest_id` | UUID |
| `folio_number` | INT |
| `guest_confirmation_number` | TEXT |
| `is_primary` | BOOLEAN |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |
| `property_id` | uuid |

### `reservation_recommendations`
- **PK:** `id`
- **FKs:** `reservation_id`→`reservations`

| Column | Type |
|---|---|
| `id` | UUID |
| `reservation_id` | UUID |
| `recommended_sites` | JSONB |
| `recommended_add_on` | JSONB |
| `created_at` | TIMESTAMPTZ |

### `reservations`
- **PK:** `id`
- **FKs:** `property_id`→`properties`, `site_id`→`sites`, `guest_id`→`guests`

| Column | Type |
|---|---|
| `id` | UUID |
| `property_id` | UUID |
| `site_id` | UUID |
| `guest_id` | UUID |
| `status` | reservation_status |
| `total_price` | DECIMAL(10,2) |
| `guests_count` | INTEGER |
| `special_requests` | TEXT |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |
| `rate_id` | uuid |
| `source_of_business_id` | UUID |
| `adults_count` | INTEGER |
| `confirmation_number` | TEXT |
| `group_block_id` | uuid |
| `city_ledger_account_id` | UUID |
| `billing_instructions` | TEXT |
| `site_type_id` | uuid |
| `share_group_id` | UUID |
| `override_rate` | numeric |
| `assignment_locked` | boolean |
| `required_attributes` | jsonb |
| `registration_signature` | TEXT |
| `checkin_source` | text |
| `hold_folio_type` | text |

### `source_of_business`
- **PK:** `id`
- **FKs:** `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | UUID |
| `property_id` | UUID |
| `code` | VARCHAR(3) |
| `definition` | TEXT |
| `is_default` | BOOLEAN |
| `created_at` | TIMESTAMP |
| `updated_at` | TIMESTAMP |

## Rates & yield


### `add_ons`
- **PK:** `id`
- **FKs:** `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | UUID |
| `property_id` | UUID |
| `name` | TEXT |
| `description` | TEXT |
| `price` | DECIMAL(10,2) |
| `category` | TEXT |
| `is_active` | BOOLEAN |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |
| `code` | VARCHAR |
| `charge_type` | text |
| `rental_item_id` | UUID |

### `package_items`
- **PK:** `id`
- **FKs:** `package_id`→`packages`, `add_on_id`→`add_ons`

| Column | Type |
|---|---|
| `id` | UUID |
| `package_id` | UUID |
| `add_on_id` | UUID |
| `quantity` | INTEGER |
| `rental_item_id` | UUID |

### `packages`
- **PK:** `id`
- **FKs:** `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | UUID |
| `property_id` | UUID |
| `name` | TEXT |
| `description` | TEXT |
| `price` | NUMERIC(10,2) |
| `charge_type` | TEXT |
| `is_active` | BOOLEAN |
| `sort_order` | INTEGER |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |

### `promo_codes`
- **PK:** `id`
- **FKs:** `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | UUID |
| `property_id` | UUID |
| `code` | TEXT |
| `description` | TEXT |
| `discount_type` | TEXT |
| `discount_value` | NUMERIC(10,2) |
| `valid_from` | DATE |
| `valid_to` | DATE |
| `max_uses` | INTEGER |
| `uses_count` | INTEGER |
| `is_active` | BOOLEAN |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |

### `rate_add_ons`
- **PK:** `id`
- **FKs:** `rate_id`→`rates`, `add_on_id`→`add_ons`

| Column | Type |
|---|---|
| `id` | UUID |
| `rate_id` | UUID |
| `add_on_id` | UUID |
| `created_at` | TIMESTAMP |

### `rate_membership_eligibility`
- **PK:** `id`
- **FKs:** `rate_id`→`rates`, `program_id`→`membership_programs`

| Column | Type |
|---|---|
| `id` | UUID |
| `rate_id` | UUID |
| `program_id` | UUID |
| `min_tier_priority` | INT |
| `member_only` | BOOLEAN |
| `discount_percent_override` | NUMERIC(5,2) |
| `created_at` | TIMESTAMPTZ |

### `rate_rules`
- **PK:** `id`
- **FKs:** `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | UUID |
| `property_id` | UUID |
| `name` | TEXT |
| `rule_type` | TEXT |
| `conditions` | JSONB |
| `multiplier` | DECIMAL(5,2) |
| `discount_amount` | DECIMAL(10,2) |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |

### `rate_seasons`
- **PK:** `id`
- **FKs:** `rate_id`→`rates`

| Column | Type |
|---|---|
| `id` | uuid |
| `rate_id` | uuid |
| `season_name` | text |
| `start_date` | date |
| `end_date` | date |
| `multiplier` | numeric |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |
| `adjustment_type` | text |

### `rate_template_pushes`
- **PK:** `id`
- **FKs:** `template_id`→`rate_templates`, `pushed_by`→`auth`

| Column | Type |
|---|---|
| `id` | uuid |
| `template_id` | uuid |
| `pushed_by` | uuid |
| `target_property_ids` | uuid[] |
| `status` | text |
| `result_summary` | jsonb |
| `error` | text |
| `created_at` | timestamptz |

### `rate_template_restrictions`
- **PK:** `id`
- **FKs:** `template_id`→`rate_templates`

| Column | Type |
|---|---|
| `id` | uuid |
| `template_id` | uuid |
| `start_date` | date |
| `end_date` | date |
| `min_los` | integer |
| `max_los` | integer |
| `cta` | boolean |
| `ctd` | boolean |
| `stop_sell` | boolean |
| `created_at` | timestamptz |

### `rate_templates`
- **PK:** `id`
- **FKs:** `organization_id`→`organizations`, `brand_id`→`brands`, `region_id`→`regions`

| Column | Type |
|---|---|
| `id` | uuid |
| `organization_id` | uuid |
| `brand_id` | uuid |
| `region_id` | uuid |
| `scope` | text |
| `template_code` | text |
| `name` | text |
| `description` | text |
| `deposit_requirement` | text |
| `adjustment_type` | text |
| `adjustment_value` | numeric |
| `is_active` | boolean |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### `rates`
- **PK:** `id`
- **FKs:** `property_id`→`properties`, `base_rate_id`→`rates`

| Column | Type |
|---|---|
| `id` | uuid |
| `property_id` | uuid |
| `rate_code` | text |
| `description` | text |
| `start_date` | date |
| `end_date` | date |
| `is_base_rate` | boolean |
| `base_rate_id` | uuid |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |
| `revenue_account_id` | uuid |
| `deposit_requirement` | text |
| `is_default` | boolean |
| `adjustment_type` | text |
| `show_on_booking_chart` | boolean |
| `show_on_booking_engine` | boolean |

### `seasons`
- **PK:** `id`
- **FKs:** `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | UUID |
| `property_id` | UUID |
| `name` | TEXT |
| `start_date` | DATE |
| `end_date` | DATE |
| `multiplier` | DECIMAL(5,2) |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |

## Accounting & payments


### `account_groups`
- **PK:** `id`
- **FKs:** `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | uuid |
| `property_id` | uuid |
| `name` | text |
| `account_type` | account_type |
| `sort_order` | integer |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### `account_taxes`
- **PK:** `id`
- **FKs:** `revenue_account_id`→`accounts`, `tax_account_id`→`accounts`, `inclusive_of_tax_id`→`account_taxes`

| Column | Type |
|---|---|
| `id` | uuid |
| `property_id` | uuid |
| `revenue_account_id` | uuid |
| `tax_account_id` | uuid |
| `calculation_type` | text |
| `rate_value` | numeric |
| `inclusive_of_tax_id` | uuid |
| `sort_order` | integer |
| `is_active` | boolean |
| `created_at` | timestamp |
| `updated_at` | timestamp |

### `accounting_integrations`
- **PK:** `id`
- **FKs:** `property_id`→`properties`, `connected_by`→`auth`

| Column | Type |
|---|---|
| `id` | UUID |
| `property_id` | UUID |
| `provider` | TEXT |
| `environment` | TEXT |
| `realm_id` | TEXT |
| `access_token` | TEXT |
| `refresh_token` | TEXT |
| `token_expires_at` | TIMESTAMPTZ |
| `refresh_token_expires_at` | TIMESTAMPTZ |
| `company_name` | TEXT |
| `is_active` | BOOLEAN |
| `connected_at` | TIMESTAMPTZ |
| `connected_by` | UUID |
| `last_sync_at` | TIMESTAMPTZ |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |
| `sync_frequency` | TEXT |

### `accounting_sync_log`
- **PK:** `id`
- **FKs:** `property_id`→`properties`, `dayend_close_id`→`dayend_closes`, `synced_by`→`auth`

| Column | Type |
|---|---|
| `id` | UUID |
| `property_id` | UUID |
| `provider` | TEXT |
| `dayend_close_id` | UUID |
| `sync_type` | TEXT |
| `status` | TEXT |
| `external_ref` | TEXT |
| `request_payload` | JSONB |
| `response_payload` | JSONB |
| `error_message` | TEXT |
| `synced_at` | TIMESTAMPTZ |
| `synced_by` | UUID |
| `created_at` | TIMESTAMPTZ |

### `accounts`
- **PK:** `id`
- **FKs:** `property_id`→`properties`, `account_group_id`→`account_groups`

| Column | Type |
|---|---|
| `id` | uuid |
| `property_id` | uuid |
| `account_group_id` | uuid |
| `code` | text |
| `name` | text |
| `description` | text |
| `is_active` | boolean |
| `normal_balance` | text |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |
| `tax_calculation_type` | text |
| `include_in_nightly_kpis` | boolean |
| `external_account` | TEXT |
| `payment_type` | text |
| `qb_account_id` | TEXT |

### `change_journal`
- **PK:** `id`
- **FKs:** `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | uuid |
| `property_id` | uuid |
| `record_type` | text |
| `record_id` | uuid |
| `record_identifier` | text |
| `field_name` | text |
| `old_value` | text |
| `new_value` | text |
| `changed_by` | uuid |
| `changed_by_name` | text |
| `created_at` | timestamptz |

### `city_ledger_invoice_payments`
- **PK:** `id`
- **FKs:** `invoice_id`→`city_ledger_invoices`, `payment_transaction_id`→`ledger_transactions`

| Column | Type |
|---|---|
| `id` | UUID |
| `invoice_id` | UUID |
| `payment_transaction_id` | UUID |
| `applied_amount` | NUMERIC |
| `applied_at` | TIMESTAMPTZ |
| `applied_by_name` | TEXT |

### `city_ledger_invoices`
- **PK:** `id`
- **FKs:** `city_ledger_account_id`→`ledger_accounts`, `source_folio_id`→`ledger_accounts`, `reservation_id`→`reservations`, `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | UUID |
| `city_ledger_account_id` | UUID |
| `source_folio_id` | UUID |
| `reservation_id` | UUID |
| `confirmation_number` | TEXT |
| `guest_name` | TEXT |
| `room_number` | TEXT |
| `transfer_date` | DATE |
| `original_amount` | NUMERIC |
| `paid_amount` | NUMERIC |
| `status` | TEXT |
| `notes` | TEXT |
| `property_id` | UUID |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |

### `dayend_closes`
- **PK:** `id`
- **FKs:** `property_id`→`properties`, `night_audit_id`→`night_audits`

| Column | Type |
|---|---|
| `id` | UUID |
| `property_id` | UUID |
| `close_date` | DATE |
| `night_audit_id` | UUID |
| `status` | TEXT |
| `closed_at` | TIMESTAMP |
| `closed_by` | UUID |
| `closed_by_name` | TEXT |
| `--` | Summary |
| `total_revenue` | NUMERIC |
| `total_taxes` | NUMERIC |
| `total_payments` | NUMERIC |
| `total_refunds` | NUMERIC |
| `opening_ar_balance` | NUMERIC |
| `closing_ar_balance` | NUMERIC |
| `--` | Report |
| `account_summary` | JSONB |
| `ledger_summary` | JSONB |
| `created_at` | TIMESTAMP |
| `updated_at` | TIMESTAMP |
| `exceptions_handled` | integer |

### `dayend_exceptions`
- **PK:** `id`
- **FKs:** `property_id`→`properties`, `night_audit_id`→`night_audits`, `dayend_close_id`→`dayend_closes`, `reservation_id`→`reservations`

| Column | Type |
|---|---|
| `id` | uuid |
| `property_id` | uuid |
| `close_date` | date |
| `night_audit_id` | uuid |
| `dayend_close_id` | uuid |
| `reservation_id` | uuid |
| `confirmation_number` | text |
| `guest_name` | text |
| `site_number` | text |
| `exception_type` | text |
| `action_taken` | text |
| `status_before` | text |
| `status_after` | text |
| `amount_posted` | numeric |
| `resolution` | text |
| `details` | jsonb |
| `performed_by` | uuid |
| `performed_by_name` | text |
| `created_at` | timestamptz |
| `deposit_amount` | numeric |

### `deposit_policies`
- **PK:** `id`
- **FKs:** `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | UUID |
| `property_id` | UUID |
| `name` | TEXT |
| `description` | TEXT |
| `is_default` | BOOLEAN |
| `deposit_type` | TEXT |
| `deposit_value` | NUMERIC(10,2) |
| `deposit_due` | TEXT |
| `deposit_due_days` | INTEGER |
| `payment_mode` | TEXT |
| `cancellation_tiers` | JSONB |
| `no_show_charge_type` | TEXT |
| `no_show_charge_value` | NUMERIC(10,2) |
| `is_active` | BOOLEAN |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |

### `folio_postings`
- **PK:** `id`
- **FKs:** `ledger_transaction_id`→`ledger_transactions`, `ledger_account_id`→`ledger_accounts`, `account_id`→`accounts`, `night_audit_id`→`night_audits`

| Column | Type |
|---|---|
| `id` | UUID |
| `ledger_transaction_id` | UUID |
| `ledger_account_id` | UUID |
| `account_id` | UUID |
| `night_audit_id` | UUID |
| `posting_date` | DATE |
| `posting_type` | TEXT |
| `description` | TEXT |
| `amount` | NUMERIC |
| `running_balance` | NUMERIC |
| `posted_by` | UUID |
| `posted_by_name` | TEXT |
| `created_at` | TIMESTAMP |
| `debit_amount` | numeric |
| `is_voided` | BOOLEAN |
| `source_posting_id` | UUID |
| `property_id` | uuid |

### `folio_split_rule_allocations`
- **PK:** `id`
- **FKs:** `split_rule_id`→`folio_split_rules`, `reservation_guest_id`→`reservation_guests`

| Column | Type |
|---|---|
| `id` | UUID |
| `split_rule_id` | UUID |
| `reservation_guest_id` | UUID |
| `allocation_value` | DECIMAL(10,2) |
| `created_at` | TIMESTAMPTZ |

### `folio_split_rules`
- **PK:** `id`
- **FKs:** `reservation_id`→`reservations`, `account_id`→`accounts`

| Column | Type |
|---|---|
| `id` | UUID |
| `reservation_id` | UUID |
| `account_id` | UUID |
| `split_type` | TEXT |
| `is_active` | BOOLEAN |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |

### `intercompany_transfers`
- **PK:** `id`
- **FKs:** `organization_id`→`organizations`, `from_property_id`→`properties`, `to_property_id`→`properties`, `posted_by`→`auth`

| Column | Type |
|---|---|
| `id` | uuid |
| `organization_id` | uuid |
| `from_property_id` | uuid |
| `to_property_id` | uuid |
| `amount` | numeric(12,2) |
| `currency` | text |
| `memo` | text |
| `reference` | text |
| `status` | text |
| `posted_at` | timestamptz |
| `posted_by` | uuid |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### `journal_entries`
- **PK:** `id`
- **FKs:** `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | uuid |
| `property_id` | uuid |
| `entry_date` | date |
| `reference_number` | text |
| `description` | text |
| `is_posted` | boolean |
| `posted_at` | timestamptz |
| `posted_by` | uuid |
| `created_by` | uuid |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### `journal_entry_lines`
- **PK:** `id`
- **FKs:** `journal_entry_id`→`journal_entries`, `account_id`→`accounts`

| Column | Type |
|---|---|
| `id` | uuid |
| `journal_entry_id` | uuid |
| `account_id` | uuid |
| `debit_amount` | numeric(12,2) |
| `credit_amount` | numeric(12,2) |
| `description` | text |
| `created_at` | timestamptz |
| `property_id` | uuid |

### `ledger_accounts`
- **PK:** `id`
- **FKs:** `property_id`→`properties`, `reservation_id`→`reservations`, `guest_id`→`guests`

| Column | Type |
|---|---|
| `id` | uuid |
| `property_id` | uuid |
| `ledger_type` | ledger_type |
| `reservation_id` | uuid |
| `guest_id` | uuid |
| `company_name` | text |
| `contact_name` | text |
| `contact_email` | text |
| `balance` | numeric(12,2) |
| `is_active` | boolean |
| `opened_at` | timestamptz |
| `closed_at` | timestamptz |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |
| `street_address` | TEXT |
| `street_address_2` | TEXT |
| `city` | TEXT |
| `state` | TEXT |
| `zipcode` | TEXT |
| `country` | TEXT |
| `phone` | TEXT |
| `payment_terms_days` | INTEGER |
| `credit_limit` | NUMERIC |
| `account_number` | TEXT |
| `reservation_guest_id` | UUID |

### `ledger_transactions`
- **PK:** `id`
- **FKs:** `ledger_account_id`→`ledger_accounts`, `journal_entry_id`→`journal_entries`

| Column | Type |
|---|---|
| `id` | uuid |
| `ledger_account_id` | uuid |
| `journal_entry_id` | uuid |
| `transaction_type` | transaction_type |
| `transaction_date` | timestamptz |
| `description` | text |
| `debit_amount` | numeric(12,2) |
| `credit_amount` | numeric(12,2) |
| `reference_number` | text |
| `created_by` | uuid |
| `created_at` | timestamptz |
| `posted_by_name` | TEXT |
| `property_id` | uuid |

### `member_accounts`
- **PK:** `id`
- **FKs:** `organization_id`→`organizations`, `program_id`→`membership_programs`, `tier_id`→`membership_tiers`, `guest_id`→`guests`, `household_id`→`households`

| Column | Type |
|---|---|
| `id` | UUID |
| `organization_id` | UUID |
| `program_id` | UUID |
| `tier_id` | UUID |
| `guest_id` | UUID |
| `household_id` | UUID |
| `member_number` | TEXT |
| `status` | public.membership_account_status |
| `joined_at` | TIMESTAMPTZ |
| `activated_at` | TIMESTAMPTZ |
| `expires_at` | TIMESTAMPTZ |
| `auto_renew` | BOOLEAN |
| `points_balance` | NUMERIC(12,2) |
| `adyen_shopper_reference` | TEXT |
| `adyen_recurring_detail_reference` | TEXT |
| `notes` | TEXT |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |

### `member_dues_invoices`
- **PK:** `id`
- **FKs:** `member_account_id`→`member_accounts`, `organization_id`→`organizations`

| Column | Type |
|---|---|
| `id` | UUID |
| `member_account_id` | UUID |
| `organization_id` | UUID |
| `amount` | NUMERIC(12,2) |
| `currency` | TEXT |
| `period_start` | DATE |
| `period_end` | DATE |
| `status` | public.membership_dues_status |
| `attempted_at` | TIMESTAMPTZ |
| `paid_at` | TIMESTAMPTZ |
| `adyen_psp_reference` | TEXT |
| `failure_reason` | TEXT |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |

### `member_points_ledger`
- **PK:** `id`
- **FKs:** `member_account_id`→`member_accounts`, `organization_id`→`organizations`, `reservation_id`→`reservations`, `property_id`→`properties`, `created_by`→`auth`

| Column | Type |
|---|---|
| `id` | UUID |
| `member_account_id` | UUID |
| `organization_id` | UUID |
| `delta` | NUMERIC(12,2) |
| `balance_after` | NUMERIC(12,2) |
| `reason` | TEXT |
| `reservation_id` | UUID |
| `property_id` | UUID |
| `created_by` | UUID |
| `created_at` | TIMESTAMPTZ |

### `payment_authorizations`
- **PK:** `id`
- **FKs:** `property_id`→`properties`, `ledger_account_id`→`ledger_accounts`, `payment_card_id`→`payment_cards`

| Column | Type |
|---|---|
| `id` | UUID |
| `property_id` | UUID |
| `ledger_account_id` | UUID |
| `payment_card_id` | UUID |
| `original_amount` | DECIMAL(10,2) |
| `current_amount` | DECIMAL(10,2) |
| `captured_amount` | DECIMAL(10,2) |
| `currency` | TEXT |
| `status` | TEXT |
| `adyen_psp_reference` | TEXT |
| `adyen_auth_code` | TEXT |
| `expires_at` | TIMESTAMPTZ |
| `is_mock` | BOOLEAN |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |
| `created_by` | UUID |
| `created_by_name` | TEXT |

### `payment_cards`
- **PK:** `id`
- **FKs:** `reservation_id`→`reservations`, `ledger_account_id`→`ledger_accounts`

| Column | Type |
|---|---|
| `id` | UUID |
| `reservation_id` | UUID |
| `ledger_account_id` | UUID |
| `cardholder_name` | TEXT |
| `card_brand` | TEXT |
| `last_four_digits` | TEXT |
| `expiry_month` | INTEGER |
| `expiry_year` | INTEGER |
| `is_primary` | BOOLEAN |
| `created_at` | TIMESTAMP |
| `updated_at` | TIMESTAMP |
| `created_by` | UUID |
| `created_by_name` | TEXT |
| `property_id` | UUID |
| `reservation_guest_id` | UUID |

### `payment_transactions`
- **PK:** `id`
- **FKs:** `property_id`→`properties`, `reservation_id`→`reservations`, `ledger_account_id`→`ledger_accounts`, `payment_card_id`→`payment_cards`, `authorization_id`→`payment_authorizations`, `folio_posting_id`→`folio_postings`

| Column | Type |
|---|---|
| `id` | UUID |
| `property_id` | UUID |
| `reservation_id` | UUID |
| `ledger_account_id` | UUID |
| `payment_card_id` | UUID |
| `authorization_id` | UUID |
| `amount` | DECIMAL(10,2) |
| `currency` | TEXT |
| `transaction_type` | TEXT |
| `'tokenization',` | 'authorization' |
| `'capture',` | 'partial_capture' |
| `status` | TEXT |
| `adyen_psp_reference` | TEXT |
| `gateway_response` | JSONB |
| `source` | TEXT |
| `is_mock` | BOOLEAN |
| `folio_posting_id` | UUID |
| `created_at` | TIMESTAMPTZ |
| `created_by` | UUID |
| `created_by_name` | TEXT |

### `portfolio_metrics_daily`
- **PK:** `id`
- **FKs:** `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | uuid |
| `property_id` | uuid |
| `stay_date` | date |
| `sites_available` | integer |
| `sites_sold` | integer |
| `occupancy_pct` | numeric(5,2) |
| `adr` | numeric(10,2) |
| `revpar` | numeric(10,2) |
| `room_revenue` | numeric(12,2) |
| `ancillary_revenue` | numeric(12,2) |
| `total_revenue` | numeric(12,2) |
| `computed_at` | timestamptz |

### `statement_sends`
- **PK:** `id`
- **FKs:** `city_ledger_account_id`→`ledger_accounts`, `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | UUID |
| `city_ledger_account_id` | UUID |
| `sent_to_email` | TEXT |
| `statement_date` | DATE |
| `total_amount` | NUMERIC |
| `sent_at` | TIMESTAMPTZ |
| `sent_by_name` | TEXT |
| `is_mock` | BOOLEAN |
| `property_id` | UUID |

## Channel manager


### `api_quota_usage`
- **PK:** `id`
- **FKs:** `organization_id`→`organizations`

| Column | Type |
|---|---|
| `id` | uuid |
| `organization_id` | uuid |
| `usage_date` | date |
| `request_count` | integer |
| `booking_engine_count` | integer |
| `throttled_count` | integer |
| `updated_at` | timestamptz |

### `channel_ari_queue`
- **PK:** `id`
- **FKs:** `channel_id`→`channels`, `property_id`→`properties`, `site_type_id`→`site_types`

| Column | Type |
|---|---|
| `id` | uuid |
| `channel_id` | uuid |
| `property_id` | uuid |
| `site_type_id` | uuid |
| `stay_date` | date |
| `available_count` | integer |
| `rate_amount` | numeric(10,2) |
| `currency` | text |
| `status` | public.channel_queue_status |
| `attempts` | integer |
| `last_error` | text |
| `scheduled_for` | timestamptz |
| `sent_at` | timestamptz |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### `channel_content`
- **PK:** `id`
- **FKs:** `channel_id`→`channels`, `property_id`→`properties`, `site_type_id`→`site_types`

| Column | Type |
|---|---|
| `id` | uuid |
| `channel_id` | uuid |
| `property_id` | uuid |
| `site_type_id` | uuid |
| `display_name` | text |
| `short_description` | text |
| `long_description` | text |
| `max_occupancy` | integer |
| `amenities` | jsonb |
| `policies` | jsonb |
| `gallery_asset_ids` | uuid[] |
| `last_pushed_at` | timestamptz |
| `push_status` | text |
| `last_error` | text |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### `channel_governance_policies`
- **PK:** `id`
- **FKs:** `organization_id`→`organizations`, `brand_id`→`brands`

| Column | Type |
|---|---|
| `id` | uuid |
| `organization_id` | uuid |
| `brand_id` | uuid |
| `allowed_channels` | jsonb |
| `parity_enforced` | boolean |
| `notes` | text |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### `channel_sync_log`
- **PK:** `id`
- **FKs:** `channel_id`→`channels`, `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | uuid |
| `channel_id` | uuid |
| `property_id` | uuid |
| `direction` | public.channel_sync_direction |
| `action` | text |
| `status` | text |
| `http_status` | integer |
| `duration_ms` | integer |
| `items_count` | integer |
| `request_summary` | jsonb |
| `response_summary` | jsonb |
| `error` | text |
| `created_at` | timestamptz |

### `channels`
- **PK:** `id`
- **FKs:** `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | uuid |
| `property_id` | uuid |
| `channel_code` | public.channel_code |
| `is_enabled` | boolean |
| `hotel_id` | text |
| `currency` | text |
| `credentials_ref` | text |
| `mock_mode` | boolean |
| `status` | public.channel_status |
| `last_ari_sync_at` | timestamptz |
| `last_res_pull_at` | timestamptz |
| `last_error` | text |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### `messaging_channels`
- **PK:** `id`
- **FKs:** `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | UUID |
| `property_id` | UUID |
| `channel` | TEXT |
| `provider` | TEXT |
| `identifier` | TEXT |
| `credentials_ref` | TEXT |
| `webhook_secret` | TEXT |
| `is_active` | BOOLEAN |
| `config` | JSONB |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |

### `org_api_quotas`
- **PK:** `organization_id`
- **FKs:** `organization_id`→`organizations`

| Column | Type |
|---|---|
| `organization_id` | uuid |
| `daily_request_limit` | integer |
| `burst_per_minute` | integer |
| `booking_engine_daily_limit` | integer |
| `notes` | text |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### `ota_connections`
- **PK:** `id`
- **FKs:** `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | UUID |
| `property_id` | UUID |
| `ota_name` | TEXT |
| `api_key` | TEXT |
| `api_endpoint` | TEXT |
| `is_active` | BOOLEAN |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |

### `pos_item_variants`
- **PK:** `id`
- **FKs:** `property_id`→`properties`, `item_id`→`pos_items`

| Column | Type |
|---|---|
| `id` | uuid |
| `property_id` | uuid |
| `item_id` | uuid |
| `size` | text |
| `color` | text |
| `sku` | text |
| `barcode` | text |
| `price_override` | numeric(10,2) |
| `stock_qty` | numeric(12,2) |
| `reorder_point` | numeric(12,2) |
| `is_active` | boolean |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

## Memberships


### `member_entitlement_usage`
- **PK:** `id`
- **FKs:** `member_account_id`→`member_accounts`, `organization_id`→`organizations`

| Column | Type |
|---|---|
| `id` | UUID |
| `member_account_id` | UUID |
| `organization_id` | UUID |
| `year` | INT |
| `free_nights_used` | INT |
| `total_nights_used` | INT |
| `stays_count` | INT |
| `parks_visited` | JSONB |
| `last_stay_ended_at` | TIMESTAMPTZ |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |

### `membership_programs`
- **PK:** `id`
- **FKs:** `organization_id`→`organizations`, `brand_id`→`brands`

| Column | Type |
|---|---|
| `id` | UUID |
| `organization_id` | UUID |
| `brand_id` | UUID |
| `name` | TEXT |
| `code` | TEXT |
| `description` | TEXT |
| `currency` | TEXT |
| `billing_period` | public.membership_billing_period |
| `dues_amount` | NUMERIC(12,2) |
| `auto_renew_default` | BOOLEAN |
| `points_per_currency_unit` | NUMERIC(12,4) |
| `point_redemption_value` | NUMERIC(12,4) |
| `is_active` | BOOLEAN |
| `terms` | TEXT |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |

### `membership_tiers`
- **PK:** `id`
- **FKs:** `program_id`→`membership_programs`

| Column | Type |
|---|---|
| `id` | UUID |
| `program_id` | UUID |
| `name` | TEXT |
| `priority` | INT |
| `dues_amount_override` | NUMERIC(12,2) |
| `discount_percent` | NUMERIC(5,2) |
| `free_nights_per_year` | INT |
| `max_consecutive_nights` | INT |
| `cooldown_days` | INT |
| `parks_per_year_cap` | INT |
| `priority_booking_window_days` | INT |
| `points_multiplier` | NUMERIC(6,3) |
| `blackout_dates` | JSONB |
| `benefits` | JSONB |
| `is_active` | BOOLEAN |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |

### `webhook_catalog_endpoints`
- **PK:** `id`

| Column | Type |
|---|---|
| `id` | uuid |
| `event_key` | text |
| `display_name` | text |
| `description` | text |
| `category` | text |
| `payload_example` | jsonb |
| `is_active` | boolean |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

## Messaging, CRM & marketing


### `campaign_sends`
- **PK:** `id`
- **FKs:** `campaign_id`→`campaigns`, `guest_id`→`guests`, `reservation_id`→`reservations`

| Column | Type |
|---|---|
| `id` | UUID |
| `campaign_id` | UUID |
| `guest_id` | UUID |
| `reservation_id` | UUID |
| `sent_at` | TIMESTAMP |
| `status` | TEXT |

### `campaigns`
- **PK:** `id`
- **FKs:** `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | UUID |
| `property_id` | UUID |
| `name` | TEXT |
| `subject` | TEXT |
| `content` | TEXT |
| `channel` | TEXT |
| `status` | TEXT |
| `trigger_type` | TEXT |
| `trigger_days` | INTEGER |
| `segment_filters` | JSONB |
| `sent_count` | INTEGER |
| `created_at` | TIMESTAMP |
| `updated_at` | TIMESTAMP |

### `consolidated_ar_customers`
- **PK:** `id`
- **FKs:** `organization_id`→`organizations`

| Column | Type |
|---|---|
| `id` | uuid |
| `organization_id` | uuid |
| `name` | text |
| `code` | text |
| `billing_email` | text |
| `billing_address` | jsonb |
| `credit_limit` | numeric(12,2) |
| `notes` | text |
| `is_active` | boolean |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### `messaging_messages`
- **PK:** `id`
- **FKs:** `thread_id`→`messaging_threads`, `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | UUID |
| `thread_id` | UUID |
| `property_id` | UUID |
| `direction` | TEXT |
| `sender_type` | TEXT |
| `sender_user_id` | UUID |
| `body` | TEXT |
| `attachments` | JSONB |
| `provider_message_id` | TEXT |
| `delivery_status` | TEXT |
| `ai_generated` | BOOLEAN |
| `approved_by_user_id` | UUID |
| `metadata` | JSONB |
| `created_at` | TIMESTAMPTZ |

## AI (TrailGuide, KB, onboarding)


### `messaging_ai_actions`
- **PK:** `id`
- **FKs:** `thread_id`→`messaging_threads`, `property_id`→`properties`, `message_id`→`messaging_messages`

| Column | Type |
|---|---|
| `id` | UUID |
| `thread_id` | UUID |
| `property_id` | UUID |
| `message_id` | UUID |
| `action_type` | TEXT |
| `action_summary` | TEXT |
| `action_payload` | JSONB |
| `proposed_reply` | TEXT |
| `status` | TEXT |
| `approved_by_user_id` | UUID |
| `executed_at` | TIMESTAMPTZ |
| `result` | JSONB |
| `error_message` | TEXT |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |

### `messaging_ai_knowledge`
- **PK:** `id`
- **FKs:** `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | UUID |
| `property_id` | UUID |
| `category` | TEXT |
| `title` | TEXT |
| `body` | TEXT |
| `tags` | TEXT[] |
| `is_active` | BOOLEAN |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |

### `onboarding_progress`
- **PK:** `property_id`
- **FKs:** `property_id`→`properties`

| Column | Type |
|---|---|
| `property_id` | UUID |
| `steps` | JSONB |
| `current_step` | TEXT |
| `updated_at` | TIMESTAMPTZ |
| `updated_by` | UUID |

## Operations (work orders, POS)


### `cleaning_preferences`
- **PK:** `id`
- **FKs:** `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | uuid |
| `property_id` | uuid |
| `sheet_change_days` | integer |
| `full_clean_interval` | integer |
| `created_at` | timestamp |
| `updated_at` | timestamp |

### `housekeeping_assignments`
- **PK:** `id`
- **FKs:** `property_id`→`properties`, `staff_id`→`housekeeping_staff`, `site_id`→`sites`

| Column | Type |
|---|---|
| `id` | uuid |
| `property_id` | uuid |
| `assignment_date` | date |
| `staff_id` | uuid |
| `site_id` | uuid |
| `cleaning_type` | cleaning_type |
| `status` | assignment_status |
| `completed_at` | timestamp |
| `inspected_by` | uuid |
| `inspected_at` | timestamp |
| `notes` | text |
| `created_at` | timestamp |
| `updated_at` | timestamp |
| `assigned_by` | uuid |

### `housekeeping_zones`
- **PK:** `id`
- **FKs:** `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | uuid |
| `property_id` | uuid |
| `name` | text |
| `zone_type` | text |
| `sort_order` | integer |
| `created_at` | timestamp |
| `updated_at` | timestamp |

### `pos_categories`
- **PK:** `id`
- **FKs:** `property_id`→`properties`, `revenue_ledger_account_id`→`ledger_accounts`

| Column | Type |
|---|---|
| `id` | uuid |
| `property_id` | uuid |
| `name` | text |
| `revenue_ledger_account_id` | uuid |
| `tax_profile_id` | uuid |
| `sort_order` | integer |
| `color` | text |
| `is_active` | boolean |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### `pos_inventory_movements`
- **PK:** `id`
- **FKs:** `property_id`→`properties`, `variant_id`→`pos_item_variants`, `outlet_id`→`pos_outlets`

| Column | Type |
|---|---|
| `id` | uuid |
| `property_id` | uuid |
| `variant_id` | uuid |
| `outlet_id` | uuid |
| `change_qty` | numeric(12,2) |
| `reason` | text |
| `reference_id` | uuid |
| `notes` | text |
| `user_id` | uuid |
| `created_at` | timestamptz |

### `pos_items`
- **PK:** `id`
- **FKs:** `property_id`→`properties`, `category_id`→`pos_categories`

| Column | Type |
|---|---|
| `id` | uuid |
| `property_id` | uuid |
| `category_id` | uuid |
| `name` | text |
| `sku` | text |
| `description` | text |
| `image_url` | text |
| `track_inventory` | boolean |
| `has_variants` | boolean |
| `base_price` | numeric(10,2) |
| `cost` | numeric(10,2) |
| `is_active` | boolean |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |
| `revenue_ledger_account_id` | uuid |

### `pos_order_items`
- **PK:** `id`
- **FKs:** `property_id`→`properties`, `order_id`→`pos_orders`, `variant_id`→`pos_item_variants`, `revenue_ledger_account_id`→`ledger_accounts`

| Column | Type |
|---|---|
| `id` | uuid |
| `property_id` | uuid |
| `order_id` | uuid |
| `variant_id` | uuid |
| `item_name` | text |
| `variant_label` | text |
| `qty` | numeric(12,2) |
| `unit_price` | numeric(10,2) |
| `discount` | numeric(10,2) |
| `tax_amount` | numeric(10,2) |
| `line_total` | numeric(10,2) |
| `revenue_ledger_account_id` | uuid |
| `created_at` | timestamptz |

### `pos_order_sequences`
- **PK:** `property_id`
- **FKs:** `property_id`→`properties`

| Column | Type |
|---|---|
| `property_id` | uuid |
| `last_number` | integer |

### `pos_orders`
- **PK:** `id`
- **FKs:** `property_id`→`properties`, `outlet_id`→`pos_outlets`, `reservation_id`→`reservations`, `folio_posting_id`→`folio_postings`, `payment_transaction_id`→`payment_transactions`

| Column | Type |
|---|---|
| `id` | uuid |
| `property_id` | uuid |
| `outlet_id` | uuid |
| `order_number` | text |
| `status` | text |
| `subtotal` | numeric(10,2) |
| `tax` | numeric(10,2) |
| `discount` | numeric(10,2) |
| `total` | numeric(10,2) |
| `tender_type` | text |
| `amount_tendered` | numeric(10,2) |
| `change_due` | numeric(10,2) |
| `reservation_id` | uuid |
| `folio_posting_id` | uuid |
| `payment_transaction_id` | uuid |
| `cashier_user_id` | uuid |
| `cashier_name` | text |
| `notes` | text |
| `opened_at` | timestamptz |
| `closed_at` | timestamptz |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### `pos_outlets`
- **PK:** `id`
- **FKs:** `property_id`→`properties`, `default_revenue_ledger_account_id`→`ledger_accounts`, `cash_ledger_account_id`→`ledger_accounts`, `clearing_ledger_account_id`→`ledger_accounts`

| Column | Type |
|---|---|
| `id` | uuid |
| `property_id` | uuid |
| `name` | text |
| `code` | text |
| `is_active` | boolean |
| `default_revenue_ledger_account_id` | uuid |
| `cash_ledger_account_id` | uuid |
| `clearing_ledger_account_id` | uuid |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### `work_order_attachments`
- **PK:** `id`
- **FKs:** `work_order_id`→`work_orders`, `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | uuid |
| `work_order_id` | uuid |
| `property_id` | uuid |
| `storage_path` | text |
| `caption` | text |
| `uploaded_by_user_id` | uuid |
| `created_at` | timestamptz |

### `work_order_comments`
- **PK:** `id`
- **FKs:** `work_order_id`→`work_orders`, `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | uuid |
| `work_order_id` | uuid |
| `property_id` | uuid |
| `user_id` | uuid |
| `comment` | text |
| `is_system` | boolean |
| `created_at` | timestamptz |

### `work_order_cost_items`
- **PK:** `id`
- **FKs:** `work_order_id`→`work_orders`, `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | uuid |
| `work_order_id` | uuid |
| `property_id` | uuid |
| `cost_type` | public.wo_cost_type |
| `description` | text |
| `quantity` | numeric(12,2) |
| `unit_cost` | numeric(12,2) |
| `total_cost` | numeric(14,2) |
| `vendor_name` | text |
| `incurred_on` | date |
| `created_by_user_id` | uuid |
| `created_at` | timestamptz |

### `work_orders`
- **PK:** `id`
- **FKs:** `property_id`→`properties`, `site_id`→`sites`

| Column | Type |
|---|---|
| `id` | uuid |
| `property_id` | uuid |
| `wo_number` | text |
| `title` | text |
| `description` | text |
| `category` | public.wo_category |
| `priority` | public.wo_priority |
| `status` | public.wo_status |
| `site_id` | uuid |
| `location_text` | text |
| `reported_by_user_id` | uuid |
| `reported_at` | timestamptz |
| `assigned_to_user_id` | uuid |
| `assigned_at` | timestamptz |
| `due_date` | date |
| `completed_at` | timestamptz |
| `resolution_notes` | text |
| `deleted_at` | timestamptz |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

## Platform, compliance & misc


### `api_logs`
- **PK:** `id`
- **FKs:** `api_key_id`→`api_keys`, `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | UUID |
| `api_key_id` | UUID |
| `property_id` | UUID |
| `endpoint` | TEXT |
| `method` | TEXT |
| `status_code` | INTEGER |
| `response_time_ms` | INTEGER |
| `ip_address` | TEXT |
| `user_agent` | TEXT |
| `request_body` | JSONB |
| `error_message` | TEXT |
| `created_at` | TIMESTAMP |

### `auto_run_logs`
- **PK:** `id`
- **FKs:** `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | UUID |
| `property_id` | UUID |
| `run_type` | TEXT |
| `status` | TEXT |
| `message` | TEXT |
| `audit_date` | DATE |
| `folios_processed` | INTEGER |
| `total_room_revenue` | NUMERIC(10,2) |
| `total_tax_revenue` | NUMERIC(10,2) |
| `created_at` | TIMESTAMPTZ |

### `consolidated_ar_links`
- **PK:** `id`
- **FKs:** `customer_id`→`consolidated_ar_customers`, `property_id`→`properties`, `ledger_account_id`→`ledger_accounts`

| Column | Type |
|---|---|
| `id` | uuid |
| `customer_id` | uuid |
| `property_id` | uuid |
| `ledger_account_id` | uuid |
| `created_at` | timestamptz |

### `executive_report_snapshots`
- **PK:** `id`
- **FKs:** `organization_id`→`organizations`, `brand_id`→`brands`, `region_id`→`regions`, `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | uuid |
| `organization_id` | uuid |
| `brand_id` | uuid |
| `region_id` | uuid |
| `period_start` | date |
| `period_end` | date |
| `scope` | text |
| `property_id` | uuid |
| `kpis` | jsonb |
| `computed_at` | timestamptz |

### `gallery_assets`
- **PK:** `id`
- **FKs:** `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | UUID |
| `property_id` | UUID |
| `scope` | TEXT |
| `scope_id` | UUID |
| `storage_path` | TEXT |
| `alt_text` | TEXT |
| `caption` | TEXT |
| `sort_order` | INTEGER |
| `is_hero` | BOOLEAN |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |

### `gl_export_schedules`
- **PK:** `id`
- **FKs:** `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | uuid |
| `property_id` | uuid |
| `target` | text |
| `cadence` | text |
| `last_run_at` | timestamptz |
| `next_run_at` | timestamptz |
| `is_active` | boolean |
| `config` | jsonb |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### `guarantee_options`
- **PK:** `id`
- **FKs:** `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | UUID |
| `property_id` | UUID |
| `code` | VARCHAR(4) |
| `description` | TEXT |
| `sort_order` | INTEGER |
| `is_active` | BOOLEAN |
| `created_at` | TIMESTAMP |
| `updated_at` | TIMESTAMP |

### `los_discount_rules`
- **PK:** `id`
- **FKs:** `property_id`→`properties`

| Column | Type |
|---|---|
| `id` | UUID |
| `property_id` | UUID |
| `name` | TEXT |
| `min_nights` | INTEGER |
| `discount_type` | TEXT |
| `discount_value` | NUMERIC(10,2) |
| `is_active` | BOOLEAN |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |

### `messaging_threads`
- **PK:** `id`
- **FKs:** `property_id`→`properties`, `channel_id`→`messaging_channels`, `guest_id`→`guests`, `reservation_id`→`reservations`

| Column | Type |
|---|---|
| `id` | UUID |
| `property_id` | UUID |
| `channel_id` | UUID |
| `channel` | TEXT |
| `guest_id` | UUID |
| `reservation_id` | UUID |
| `external_participant` | TEXT |
| `display_name` | TEXT |
| `subject` | TEXT |
| `status` | TEXT |
| `category` | TEXT |
| `assigned_to_user_id` | UUID |
| `assigned_role` | TEXT |
| `ai_mode` | TEXT |
| `unread_count` | INT |
| `last_message_at` | TIMESTAMPTZ |
| `last_message_preview` | TEXT |
| `created_at` | TIMESTAMPTZ |
| `updated_at` | TIMESTAMPTZ |

### `org_compliance_settings`
- **PK:** `organization_id`
- **FKs:** `organization_id`→`organizations`

| Column | Type |
|---|---|
| `organization_id` | uuid |
| `data_residency` | text |
| `byok_enabled` | boolean |
| `byok_key_reference` | text |
| `dpa_url` | text |
| `subprocessors_url` | text |
| `soc2_readiness_state` | text |
| `soc2_last_review_at` | timestamptz |
| `security_contact_email` | text |
| `incident_response_url` | text |
| `notes` | text |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |

### `org_sandbox_environments`
- **PK:** `id`
- **FKs:** `parent_organization_id`→`organizations`, `sandbox_organization_id`→`organizations`, `provisioned_by`→`auth`

| Column | Type |
|---|---|
| `id` | uuid |
| `parent_organization_id` | uuid |
| `sandbox_organization_id` | uuid |
| `label` | text |
| `provisioned_at` | timestamptz |
| `provisioned_by` | uuid |
| `is_active` | boolean |

### `service_status_incident_updates`
- **PK:** `id`
- **FKs:** `incident_id`→`service_status_incidents`

| Column | Type |
|---|---|
| `id` | uuid |
| `incident_id` | uuid |
| `status` | text |
| `message` | text |
| `posted_at` | timestamptz |

### `service_status_incidents`
- **PK:** `id`

| Column | Type |
|---|---|
| `id` | uuid |
| `title` | text |
| `status` | text |
| `severity` | text |
| `affected_components` | text[] |
| `started_at` | timestamptz |
| `resolved_at` | timestamptz |
| `summary` | text |
| `created_at` | timestamptz |
| `updated_at` | timestamptz |
