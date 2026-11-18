-- Add feature sharing columns to organizations table (moving from property_groups)
ALTER TABLE public.organizations 
  ADD COLUMN IF NOT EXISTS share_chart_of_accounts boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_reporting boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_user_access boolean DEFAULT false;

-- Migrate existing property group settings to their organizations
UPDATE public.organizations o
SET 
  share_chart_of_accounts = COALESCE((
    SELECT pg.share_chart_of_accounts 
    FROM public.property_groups pg 
    WHERE pg.organization_id = o.id 
    LIMIT 1
  ), false),
  share_reporting = COALESCE((
    SELECT pg.share_reporting 
    FROM public.property_groups pg 
    WHERE pg.organization_id = o.id 
    LIMIT 1
  ), false),
  share_user_access = COALESCE((
    SELECT pg.share_user_access 
    FROM public.property_groups pg 
    WHERE pg.organization_id = o.id 
    LIMIT 1
  ), false);