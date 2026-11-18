-- Create a sequence starting at 1000 for customer IDs
CREATE SEQUENCE IF NOT EXISTS public.property_customer_id_seq START WITH 1000;

-- Add customer_id column to properties table
ALTER TABLE public.properties 
ADD COLUMN customer_id INTEGER UNIQUE DEFAULT nextval('public.property_customer_id_seq');

-- Update existing properties to have customer IDs (they'll get sequential values starting at 1000)
UPDATE public.properties 
SET customer_id = nextval('public.property_customer_id_seq')
WHERE customer_id IS NULL;