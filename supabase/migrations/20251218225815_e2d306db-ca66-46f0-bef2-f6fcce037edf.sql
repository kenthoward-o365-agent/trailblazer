-- Phase 2.6b: Fix campaigns and API tables RLS

-- Drop existing policies for campaigns
DROP POLICY IF EXISTS "Staff can view campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Staff can create campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Staff can update campaigns" ON public.campaigns;
DROP POLICY IF EXISTS "Staff can delete campaigns" ON public.campaigns;

-- Create properly scoped policies for campaigns
CREATE POLICY "Staff can view property campaigns" 
ON public.campaigns FOR SELECT TO authenticated
USING (user_has_property_access(property_id));

CREATE POLICY "Staff can create property campaigns" 
ON public.campaigns FOR INSERT TO authenticated
WITH CHECK (user_has_property_access(property_id));

CREATE POLICY "Staff can update property campaigns" 
ON public.campaigns FOR UPDATE TO authenticated
USING (user_has_property_access(property_id));

CREATE POLICY "Managers can delete property campaigns" 
ON public.campaigns FOR DELETE TO authenticated
USING (
  user_has_property_access(property_id) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager')
  )
);

-- Drop existing policies for campaign_sends
DROP POLICY IF EXISTS "Staff can view campaign sends" ON public.campaign_sends;
DROP POLICY IF EXISTS "Staff can create campaign sends" ON public.campaign_sends;

-- Create properly scoped policies for campaign_sends (via campaigns)
CREATE POLICY "Staff can view property campaign sends" 
ON public.campaign_sends FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_sends.campaign_id
    AND user_has_property_access(c.property_id)
  )
);

CREATE POLICY "Staff can create property campaign sends" 
ON public.campaign_sends FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.campaigns c
    WHERE c.id = campaign_sends.campaign_id
    AND user_has_property_access(c.property_id)
  )
);

-- Drop existing policies for api_keys
DROP POLICY IF EXISTS "Property admins can view their API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Property admins can create API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Property admins can update API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Property admins can delete API keys" ON public.api_keys;

-- Create properly scoped policies for api_keys
CREATE POLICY "Property admins can view property API keys" 
ON public.api_keys FOR SELECT TO authenticated
USING (
  user_has_property_access(property_id) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager')
  )
);

CREATE POLICY "Property admins can create property API keys" 
ON public.api_keys FOR INSERT TO authenticated
WITH CHECK (
  user_has_property_access(property_id) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager')
  )
);

CREATE POLICY "Property admins can update property API keys" 
ON public.api_keys FOR UPDATE TO authenticated
USING (
  user_has_property_access(property_id) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager')
  )
);

CREATE POLICY "Property admins can delete property API keys" 
ON public.api_keys FOR DELETE TO authenticated
USING (
  user_has_property_access(property_id) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager')
  )
);

-- Drop existing policies for api_logs
DROP POLICY IF EXISTS "Property admins can view API logs" ON public.api_logs;
DROP POLICY IF EXISTS "System can insert API logs" ON public.api_logs;

-- Create properly scoped policies for api_logs
CREATE POLICY "Property admins can view property API logs" 
ON public.api_logs FOR SELECT TO authenticated
USING (
  property_id IS NOT NULL AND 
  user_has_property_access(property_id) AND (
    has_role(auth.uid(), 'admin') OR 
    has_role(auth.uid(), 'manager')
  )
);

-- Allow service role to insert logs (no auth check needed for system inserts)
CREATE POLICY "Service can insert API logs" 
ON public.api_logs FOR INSERT TO authenticated
WITH CHECK (true);