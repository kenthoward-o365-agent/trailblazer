-- Update the generate_confirmation_number function to use 7 digits
CREATE OR REPLACE FUNCTION public.generate_confirmation_number()
RETURNS TRIGGER AS $$
DECLARE
  next_num INTEGER;
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
  
  -- Format confirmation number as 7-digit zero-padded number (expanded from 6)
  NEW.confirmation_number := LPAD(next_num::TEXT, 7, '0');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Backfill existing confirmation numbers to 7 digits
UPDATE public.reservations 
SET confirmation_number = LPAD(confirmation_number, 7, '0')
WHERE LENGTH(confirmation_number) < 7;