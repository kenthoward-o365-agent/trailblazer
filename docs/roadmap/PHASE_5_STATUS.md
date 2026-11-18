# Phase 5 — Trust, Scale, Procurement

## Delivered

### Compliance & data governance
- `org_compliance_settings` — data residency (US/CA/EU), BYOK toggle + KMS key reference, DPA / subprocessors URLs, SOC 2 readiness state, security contact, incident-response URL.
- Admin UI at `/admin/compliance` for org admins and super admins.

### Enterprise procurement surface
- Public **Trust Center** at `/trust` — access, PCI, residency, BYOK, ops, legal panels. App-owned copy, no independent certification claims.
- Public **Status page** at `/status` fed by `service_status_incidents` + `service_status_incident_updates`. Admin at `/admin/status-incidents`.
- **Webhook catalog** table + admin/public view at `/admin/webhook-catalog`, seeded with reservation/folio/payment/membership/night-audit/work-order events.
- **Sandbox environments** table (`org_sandbox_environments`) marking sibling orgs as sandboxes.

### Scale & reliability
- `org_api_quotas` — daily API, burst per minute, booking-engine daily. `api_quota_usage` daily counter (RLS: org admins read).
- Admin UI at `/admin/api-quotas` with a 14-day usage table.

### White-label per brand
- `brand_white_label` — custom domain, sender email/name, logo, favicon, primary/accent colors, theme_tokens JSON, active flag.
- Admin UI at `/admin/white-label`.

### Navigation
- New Admin sidebar entries: Compliance Center, API Quotas, Status Incidents, Brand White-Label, Webhook Catalog.

## Follow-ups (not built)
- **Actual enforcement**: quotas are recorded but not yet enforced by an edge middleware. Wire `api_quota_usage` from the OTA/POS/booking-engine functions and reject when the daily cap trips.
- **Custom-domain provisioning**: `brand_white_label.custom_domain` is stored but does not yet trigger DNS/SSL provisioning; hook into the existing custom-domain flow.
- **BYOK crypto**: key reference is stored; wire warehouse-export and PDF/CSV generation to encrypt with the referenced KMS key.
- **Status page auto-signals**: currently manual. Add heartbeat probes + auto-open incidents from edge-function error budgets.
- **SOC 2 evidence collector**: link readiness state to actual evidence artifacts (audit logs, RLS attestation, backup proofs).
- **Sandbox provisioning worker**: table is present; add an edge function that clones config from parent org into the sandbox org and reseeds sample data.
- **Webhook delivery pipeline**: catalog is documented; outbound HMAC-signed delivery + retry queue still to build.

## Access model
- All Phase 5 admin tables are org-scoped via `user_has_org_admin_access` / `user_has_brand_access` and superadmin write; public trust and status pages are readable anonymously.
