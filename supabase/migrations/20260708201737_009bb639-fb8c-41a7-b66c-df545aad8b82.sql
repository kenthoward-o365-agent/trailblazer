-- 1) Add CHECK_IN_HOLD status
ALTER TYPE public.reservation_status ADD VALUE IF NOT EXISTS 'CHECK_IN_HOLD';

-- 2) Reservations: online check-in metadata
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS checkin_source text,
  ADD COLUMN IF NOT EXISTS checked_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS signature_path text,
  ADD COLUMN IF NOT EXISTS signature_captured_at timestamptz,
  ADD COLUMN IF NOT EXISTS needs_staff_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checkin_hold_reason text,
  ADD COLUMN IF NOT EXISTS checkin_hold_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_reservations_needs_review
  ON public.reservations (property_id, needs_staff_review)
  WHERE needs_staff_review = true;

-- 3) Rate-limit table for guest login (unauthenticated public traffic)
CREATE TABLE IF NOT EXISTS public.guest_login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  confirmation_number text NOT NULL,
  ip_address text,
  succeeded boolean NOT NULL DEFAULT false,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_guest_login_attempts_lookup
  ON public.guest_login_attempts (property_id, confirmation_number, attempted_at DESC);

GRANT ALL ON public.guest_login_attempts TO service_role;
ALTER TABLE public.guest_login_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role manages guest_login_attempts"
  ON public.guest_login_attempts
  FOR ALL
  USING (false)
  WITH CHECK (false);