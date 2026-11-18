-- Drop the old constraint and add updated one with correct values
ALTER TABLE account_taxes DROP CONSTRAINT IF EXISTS account_taxes_calculation_type_check;

ALTER TABLE account_taxes ADD CONSTRAINT account_taxes_calculation_type_check 
CHECK (calculation_type = ANY (ARRAY[
  'percentage'::text, 
  'percentage_on_revenue'::text, 
  'percentage_on_tax'::text,
  'inclusive'::text, 
  'vat'::text, 
  'vat_inclusive'::text,
  'flat_per_day'::text, 
  'flat_per_vehicle'::text,
  'flat_per_adult'::text
]));