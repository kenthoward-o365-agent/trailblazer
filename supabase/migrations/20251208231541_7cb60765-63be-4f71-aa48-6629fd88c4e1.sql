-- Add 'tax' to the account_type enum
ALTER TYPE account_type ADD VALUE 'tax';

-- Create a table to store tax configurations for revenue accounts
CREATE TABLE public.account_taxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL,
  revenue_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  tax_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  calculation_type text NOT NULL CHECK (calculation_type IN ('percentage', 'inclusive', 'vat', 'flat_per_day', 'flat_per_vehicle')),
  rate_value numeric NOT NULL DEFAULT 0,
  inclusive_of_tax_id uuid REFERENCES public.account_taxes(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT unique_revenue_tax_pair UNIQUE (revenue_account_id, tax_account_id),
  CONSTRAINT max_five_taxes_per_revenue CHECK (sort_order >= 0 AND sort_order < 5)
);

-- Enable RLS
ALTER TABLE public.account_taxes ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Staff can view account taxes"
ON public.account_taxes
FOR SELECT
USING (true);

CREATE POLICY "Admins and managers can manage account taxes"
ON public.account_taxes
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_account_taxes_updated_at
BEFORE UPDATE ON public.account_taxes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();