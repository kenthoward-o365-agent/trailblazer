-- Add adjustment fields to rate_seasons table
ALTER TABLE public.rate_seasons 
ADD COLUMN IF NOT EXISTS adjustment_type text DEFAULT 'percent_up',
ADD COLUMN IF NOT EXISTS adjustment_value numeric DEFAULT 0;

-- Migrate existing multiplier data to new adjustment fields
UPDATE public.rate_seasons
SET adjustment_type = CASE 
  WHEN multiplier >= 1 THEN 'percent_up'
  ELSE 'percent_down'
END,
adjustment_value = CASE 
  WHEN multiplier >= 1 THEN (multiplier - 1) * 100
  ELSE (1 - multiplier) * 100
END;