-- Add is_default column to rates table
ALTER TABLE rates ADD COLUMN is_default boolean NOT NULL DEFAULT false;

-- Create a partial unique index to enforce only one default rate per property
CREATE UNIQUE INDEX idx_rates_single_default_per_property 
ON rates (property_id) 
WHERE is_default = true;

-- Create a function to ensure only one default rate per property
CREATE OR REPLACE FUNCTION public.ensure_single_default_rate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.rates 
    SET is_default = false 
    WHERE property_id = NEW.property_id 
      AND id != NEW.id 
      AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger to ensure only one default rate per property
CREATE TRIGGER ensure_single_default_rate_trigger
BEFORE INSERT OR UPDATE ON public.rates
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_default_rate();