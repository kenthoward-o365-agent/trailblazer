-- Add new internal roles to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'internal_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sales';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'support';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'finance';