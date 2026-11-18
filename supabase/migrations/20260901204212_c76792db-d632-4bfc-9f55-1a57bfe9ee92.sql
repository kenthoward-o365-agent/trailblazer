ALTER TABLE public.night_audit_settings
  ADD COLUMN IF NOT EXISTS deposit_action text NOT NULL DEFAULT 'hold_review';

ALTER TABLE public.night_audit_settings
  DROP CONSTRAINT IF EXISTS night_audit_settings_deposit_action_check;
ALTER TABLE public.night_audit_settings
  ADD CONSTRAINT night_audit_settings_deposit_action_check
  CHECK (deposit_action IN ('forfeit','hold_review','stop'));

ALTER TABLE public.dayend_exceptions
  ADD COLUMN IF NOT EXISTS deposit_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_disposition text,
  ADD COLUMN IF NOT EXISTS deposit_folio_id uuid;