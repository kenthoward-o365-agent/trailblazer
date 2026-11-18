-- Add adjustment columns to rates table for derived rate calculations
ALTER TABLE public.rates 
ADD COLUMN IF NOT EXISTS adjustment_type text,
ADD COLUMN IF NOT EXISTS adjustment_value numeric;