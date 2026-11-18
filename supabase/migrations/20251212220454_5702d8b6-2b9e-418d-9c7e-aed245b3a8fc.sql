ALTER TABLE public.add_ons 
ADD COLUMN charge_type text NOT NULL DEFAULT 'nightly' 
CHECK (charge_type IN ('nightly', 'one_time'));