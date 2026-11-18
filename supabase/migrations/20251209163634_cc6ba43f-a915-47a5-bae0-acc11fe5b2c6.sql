-- Create source_of_business table
CREATE TABLE public.source_of_business (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id),
  code VARCHAR(3) NOT NULL,
  definition TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(property_id, code)
);

-- Enable RLS
ALTER TABLE public.source_of_business ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Staff can view source of business" 
ON public.source_of_business 
FOR SELECT 
USING (true);

CREATE POLICY "Staff can manage source of business" 
ON public.source_of_business 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Add source_of_business_id to reservations
ALTER TABLE public.reservations 
ADD COLUMN source_of_business_id UUID REFERENCES public.source_of_business(id);

-- Function to ensure only one default per property
CREATE OR REPLACE FUNCTION public.ensure_single_default_source()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.source_of_business 
    SET is_default = false 
    WHERE property_id = NEW.property_id AND id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER ensure_single_default_source_trigger
BEFORE INSERT OR UPDATE ON public.source_of_business
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_default_source();

-- Update timestamp trigger
CREATE TRIGGER update_source_of_business_updated_at
BEFORE UPDATE ON public.source_of_business
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();