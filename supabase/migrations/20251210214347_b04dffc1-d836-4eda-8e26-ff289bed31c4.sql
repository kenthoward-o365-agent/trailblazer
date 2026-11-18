-- Create junction table for rate add-ons (package rates)
CREATE TABLE public.rate_add_ons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  rate_id UUID NOT NULL REFERENCES public.rates(id) ON DELETE CASCADE,
  add_on_id UUID NOT NULL REFERENCES public.add_ons(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(rate_id, add_on_id)
);

-- Enable RLS
ALTER TABLE public.rate_add_ons ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Staff can view rate add-ons" ON public.rate_add_ons
FOR SELECT USING (true);

CREATE POLICY "Staff can manage rate add-ons" ON public.rate_add_ons
FOR ALL USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);