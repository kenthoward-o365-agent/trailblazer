-- Add a default value to confirmation_number so TypeScript Insert type makes it optional
-- The trigger will override this default
ALTER TABLE public.reservations
ALTER COLUMN confirmation_number SET DEFAULT '';