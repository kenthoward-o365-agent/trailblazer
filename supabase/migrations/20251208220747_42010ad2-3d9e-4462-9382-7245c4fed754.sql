-- Add new guest profile fields
ALTER TABLE public.guests 
ADD COLUMN IF NOT EXISTS title text,
ADD COLUMN IF NOT EXISTS street_address text,
ADD COLUMN IF NOT EXISTS city text,
ADD COLUMN IF NOT EXISTS state text,
ADD COLUMN IF NOT EXISTS zipcode text,
ADD COLUMN IF NOT EXISTS phone2 text;