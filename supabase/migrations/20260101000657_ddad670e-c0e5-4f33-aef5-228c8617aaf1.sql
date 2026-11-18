-- Add override_rate column to reservations table for group block override rates
ALTER TABLE public.reservations ADD COLUMN IF NOT EXISTS override_rate numeric DEFAULT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN public.reservations.override_rate IS 'Override rate from group block allocation, used instead of rate_id when set';