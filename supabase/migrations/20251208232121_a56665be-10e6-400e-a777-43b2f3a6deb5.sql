-- Add tax configuration fields to accounts table for tax-type accounts
ALTER TABLE public.accounts
ADD COLUMN tax_calculation_type text CHECK (tax_calculation_type IS NULL OR tax_calculation_type IN ('percentage', 'inclusive', 'vat', 'flat_per_day', 'flat_per_vehicle')),
ADD COLUMN tax_rate_value numeric DEFAULT 0;