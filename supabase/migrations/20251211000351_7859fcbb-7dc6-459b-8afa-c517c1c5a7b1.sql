-- Add confirmation_number column to reservations
ALTER TABLE public.reservations
ADD COLUMN confirmation_number TEXT;

-- Create a sequence table to track confirmation numbers per property
CREATE TABLE public.property_confirmation_sequences (
  property_id UUID PRIMARY KEY REFERENCES public.properties(id),
  last_number INTEGER NOT NULL DEFAULT 0
);

-- Create function to generate confirmation number
CREATE OR REPLACE FUNCTION public.generate_confirmation_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
  prop_prefix TEXT;
BEGIN
  -- Get or create sequence for this property
  INSERT INTO public.property_confirmation_sequences (property_id, last_number)
  VALUES (NEW.property_id, 0)
  ON CONFLICT (property_id) DO NOTHING;
  
  -- Increment and get next number atomically
  UPDATE public.property_confirmation_sequences
  SET last_number = last_number + 1
  WHERE property_id = NEW.property_id
  RETURNING last_number INTO next_num;
  
  -- Format confirmation number as 6-digit zero-padded number
  NEW.confirmation_number := LPAD(next_num::TEXT, 6, '0');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-generate confirmation number on insert
CREATE TRIGGER set_confirmation_number
  BEFORE INSERT ON public.reservations
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_confirmation_number();

-- Add unique constraint per property
CREATE UNIQUE INDEX idx_reservations_confirmation_property 
ON public.reservations (property_id, confirmation_number);

-- Backfill existing reservations with confirmation numbers
DO $$
DECLARE
  r RECORD;
  prop_id UUID;
  next_num INTEGER;
BEGIN
  -- Get distinct properties
  FOR prop_id IN SELECT DISTINCT property_id FROM public.reservations WHERE confirmation_number IS NULL
  LOOP
    -- Initialize sequence for this property
    INSERT INTO public.property_confirmation_sequences (property_id, last_number)
    VALUES (prop_id, 0)
    ON CONFLICT (property_id) DO NOTHING;
    
    -- Update reservations for this property in order of creation
    FOR r IN 
      SELECT id 
      FROM public.reservations 
      WHERE property_id = prop_id AND confirmation_number IS NULL
      ORDER BY created_at
    LOOP
      UPDATE public.property_confirmation_sequences
      SET last_number = last_number + 1
      WHERE property_id = prop_id
      RETURNING last_number INTO next_num;
      
      UPDATE public.reservations
      SET confirmation_number = LPAD(next_num::TEXT, 6, '0')
      WHERE id = r.id;
    END LOOP;
  END LOOP;
END $$;

-- Make confirmation_number NOT NULL after backfill
ALTER TABLE public.reservations
ALTER COLUMN confirmation_number SET NOT NULL;