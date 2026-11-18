-- Add onboarding tracking fields to properties
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS setup_step INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS setup_completed BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS setup_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS setup_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provisioned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS provisioned_by UUID;

-- Backfill: existing properties are considered "already set up"
UPDATE public.properties SET setup_completed = true WHERE setup_completed IS NULL;

-- Track welcome email sends on organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS welcome_email_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS admin_user_id UUID;
