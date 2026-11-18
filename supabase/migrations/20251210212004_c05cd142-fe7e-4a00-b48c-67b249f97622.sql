-- Add code and account_id to add_ons table for Chart of Accounts integration
ALTER TABLE public.add_ons 
ADD COLUMN IF NOT EXISTS code VARCHAR(4),
ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id);

-- Create index for code lookups
CREATE INDEX IF NOT EXISTS idx_add_ons_code ON public.add_ons(code);

-- Update RLS policies to allow staff to manage add-ons
DROP POLICY IF EXISTS "Public can view active add-ons" ON public.add_ons;

CREATE POLICY "Staff can view add-ons" ON public.add_ons
FOR SELECT USING (true);

CREATE POLICY "Admins and managers can manage add-ons" ON public.add_ons
FOR ALL USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'manager'::app_role)
);

-- Create reservation_add_ons table to track add-ons attached to reservations
-- Note: This table already exists per the schema, but we need to ensure it works with our flow