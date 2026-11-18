-- Add rate_id column to reservations table
ALTER TABLE public.reservations 
ADD COLUMN rate_id uuid REFERENCES public.rates(id);

-- Create index for better query performance
CREATE INDEX idx_reservations_rate_id ON public.reservations(rate_id);