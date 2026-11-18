-- Add optional guest profile fields
ALTER TABLE public.guests 
ADD COLUMN birthday date,
ADD COLUMN anniversary date,
ADD COLUMN likes_dislikes text;