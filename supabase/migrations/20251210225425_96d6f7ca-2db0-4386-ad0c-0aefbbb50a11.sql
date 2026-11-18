-- Drop the old channel check constraint and add a new one that includes print document types
ALTER TABLE public.campaigns DROP CONSTRAINT campaigns_channel_check;

ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_channel_check 
CHECK (channel = ANY (ARRAY['email'::text, 'sms'::text, 'registration_card'::text, 'confirmation_letter'::text]));