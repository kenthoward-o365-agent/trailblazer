-- Add country column to properties table
ALTER TABLE public.properties ADD COLUMN country text DEFAULT 'US';

-- Add country column to guests table
ALTER TABLE public.guests ADD COLUMN country text DEFAULT 'US';