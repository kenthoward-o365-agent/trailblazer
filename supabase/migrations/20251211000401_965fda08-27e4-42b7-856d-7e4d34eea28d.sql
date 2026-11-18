-- Enable RLS on property_confirmation_sequences table
ALTER TABLE public.property_confirmation_sequences ENABLE ROW LEVEL SECURITY;

-- Allow the trigger function to manage sequences (it runs as SECURITY DEFINER)
-- Staff don't need direct access to this table