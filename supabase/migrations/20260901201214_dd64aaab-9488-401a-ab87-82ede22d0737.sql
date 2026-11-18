ALTER TABLE public.night_audit_settings
  ADD COLUMN IF NOT EXISTS auto_advance_audit_date boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pending_arrivals_action text NOT NULL DEFAULT 'stop',
  ADD COLUMN IF NOT EXISTS inhouse_departure_action text NOT NULL DEFAULT 'stop',
  ADD COLUMN IF NOT EXISTS ai_summary_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.night_audit_settings
  DROP CONSTRAINT IF EXISTS night_audit_settings_pending_arrivals_action_check;
ALTER TABLE public.night_audit_settings
  ADD CONSTRAINT night_audit_settings_pending_arrivals_action_check
  CHECK (pending_arrivals_action IN ('auto_cancel','move_next_day','auto_no_show','stop'));

ALTER TABLE public.night_audit_settings
  DROP CONSTRAINT IF EXISTS night_audit_settings_inhouse_departure_action_check;
ALTER TABLE public.night_audit_settings
  ADD CONSTRAINT night_audit_settings_inhouse_departure_action_check
  CHECK (inhouse_departure_action IN ('extend_stay','checkout_hold','stop'));

ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS hold_folio_type text;
ALTER TABLE public.reservations
  DROP CONSTRAINT IF EXISTS reservations_hold_folio_type_check;
ALTER TABLE public.reservations
  ADD CONSTRAINT reservations_hold_folio_type_check
  CHECK (hold_folio_type IS NULL OR hold_folio_type IN ('no_show_hold','checkout_hold'));

ALTER TABLE public.dayend_closes
  ADD COLUMN IF NOT EXISTS exceptions_handled integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ai_summary text;

CREATE TABLE IF NOT EXISTS public.dayend_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  close_date date NOT NULL,
  night_audit_id uuid REFERENCES public.night_audits(id) ON DELETE SET NULL,
  dayend_close_id uuid REFERENCES public.dayend_closes(id) ON DELETE SET NULL,
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE SET NULL,
  confirmation_number text,
  guest_name text,
  site_number text,
  exception_type text NOT NULL,
  action_taken text NOT NULL,
  status_before text,
  status_after text,
  amount_posted numeric NOT NULL DEFAULT 0,
  resolution text NOT NULL DEFAULT 'auto',
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  performed_by uuid,
  performed_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.dayend_exceptions TO authenticated;
GRANT ALL ON public.dayend_exceptions TO service_role;

ALTER TABLE public.dayend_exceptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view dayend exceptions for their properties"
  ON public.dayend_exceptions FOR SELECT TO authenticated
  USING (public.user_has_property_access(property_id));

CREATE POLICY "Users can insert dayend exceptions for their properties"
  ON public.dayend_exceptions FOR INSERT TO authenticated
  WITH CHECK (public.user_has_property_access(property_id));

CREATE INDEX IF NOT EXISTS idx_dayend_exceptions_property_date
  ON public.dayend_exceptions (property_id, close_date DESC);