ALTER TABLE public.reservations 
  ADD COLUMN IF NOT EXISTS registration_signature TEXT,
  ADD COLUMN IF NOT EXISTS registration_signed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS registration_signed_name TEXT;