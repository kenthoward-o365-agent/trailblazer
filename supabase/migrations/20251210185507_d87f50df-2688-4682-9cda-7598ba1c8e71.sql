-- Create guarantee_options table
CREATE TABLE public.guarantee_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  code VARCHAR(4) NOT NULL,
  description TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT guarantee_options_code_check CHECK (code ~ '^[A-Za-z0-9]{1,4}$'),
  CONSTRAINT guarantee_options_property_code_unique UNIQUE (property_id, code)
);

-- Enable RLS
ALTER TABLE public.guarantee_options ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Staff can view guarantee options"
ON public.guarantee_options
FOR SELECT
USING (true);

CREATE POLICY "Admins and managers can manage guarantee options"
ON public.guarantee_options
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Add updated_at trigger
CREATE TRIGGER update_guarantee_options_updated_at
BEFORE UPDATE ON public.guarantee_options
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();