-- Add 'declined' status to assignment_status enum
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'declined';