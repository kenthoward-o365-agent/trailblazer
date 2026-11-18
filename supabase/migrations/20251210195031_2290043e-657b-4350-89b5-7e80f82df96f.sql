-- Add deposit requirement column to rates table
ALTER TABLE public.rates 
ADD COLUMN deposit_requirement text NOT NULL DEFAULT 'none';

-- Add comment for documentation
COMMENT ON COLUMN public.rates.deposit_requirement IS 'Deposit requirement for reservations using this rate: none, 100_percent, 50_percent, first_night_tax';