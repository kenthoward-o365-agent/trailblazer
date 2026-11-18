-- Drop the existing check constraint and add a new one with updated values
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_tax_calculation_type_check;

ALTER TABLE public.accounts ADD CONSTRAINT accounts_tax_calculation_type_check 
CHECK (tax_calculation_type IS NULL OR tax_calculation_type IN (
  'percentage',
  'percentage_on_revenue',
  'percentage_on_tax',
  'vat',
  'vat_inclusive',
  'inclusive',
  'flat_per_day',
  'flat_per_vehicle',
  'flat_per_adult'
));