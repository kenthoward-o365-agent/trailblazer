-- Add property contact details columns
ALTER TABLE public.properties 
ADD COLUMN IF NOT EXISTS phone1 text,
ADD COLUMN IF NOT EXISTS phone2 text,
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS website text;