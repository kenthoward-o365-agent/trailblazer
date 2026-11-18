-- Add security settings columns to properties table
ALTER TABLE public.properties
ADD COLUMN IF NOT EXISTS session_timeout_minutes integer DEFAULT 15,
ADD COLUMN IF NOT EXISTS require_mfa boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS password_min_length integer DEFAULT 12,
ADD COLUMN IF NOT EXISTS password_require_uppercase boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS password_require_number boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS password_require_special boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS password_rotation_days integer DEFAULT 90,
ADD COLUMN IF NOT EXISTS max_failed_login_attempts integer DEFAULT 5,
ADD COLUMN IF NOT EXISTS lockout_duration_minutes integer DEFAULT 30;

-- Create login_attempts table for tracking failed logins
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  property_id uuid REFERENCES public.properties(id),
  attempt_time timestamp with time zone NOT NULL DEFAULT now(),
  success boolean NOT NULL DEFAULT false,
  ip_address text,
  user_agent text
);

-- Enable RLS on login_attempts
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Create policies for login_attempts
CREATE POLICY "Super admins can view all login attempts"
ON public.login_attempts
FOR SELECT
USING (is_super_admin());

CREATE POLICY "Users can view their own login attempts"
ON public.login_attempts
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "System can insert login attempts"
ON public.login_attempts
FOR INSERT
WITH CHECK (true);

-- Create security_audit_logs table
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  property_id uuid REFERENCES public.properties(id),
  event_type text NOT NULL,
  event_description text,
  ip_address text,
  user_agent text,
  metadata jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on security_audit_logs
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for security_audit_logs
CREATE POLICY "Super admins can view all audit logs"
ON public.security_audit_logs
FOR SELECT
USING (is_super_admin());

CREATE POLICY "Org admins can view their property audit logs"
ON public.security_audit_logs
FOR SELECT
USING (
  property_id IN (
    SELECT p.id FROM properties p
    JOIN user_property_access upa ON upa.organization_id = p.organization_id
    WHERE upa.user_id = auth.uid() AND upa.is_org_admin = true
  )
);

CREATE POLICY "System can insert audit logs"
ON public.security_audit_logs
FOR INSERT
WITH CHECK (true);

-- Create user_password_history table
CREATE TABLE IF NOT EXISTS public.user_password_history (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  password_changed_at timestamp with time zone NOT NULL DEFAULT now(),
  changed_by uuid
);

-- Enable RLS on user_password_history
ALTER TABLE public.user_password_history ENABLE ROW LEVEL SECURITY;

-- Create policies for user_password_history
CREATE POLICY "Users can view their own password history"
ON public.user_password_history
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "System can manage password history"
ON public.user_password_history
FOR ALL
USING (true)
WITH CHECK (true);

-- Create user_lockouts table
CREATE TABLE IF NOT EXISTS public.user_lockouts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  locked_at timestamp with time zone NOT NULL DEFAULT now(),
  unlock_at timestamp with time zone,
  reason text,
  unlocked_by uuid,
  unlocked_at timestamp with time zone
);

-- Enable RLS on user_lockouts
ALTER TABLE public.user_lockouts ENABLE ROW LEVEL SECURITY;

-- Create policies for user_lockouts
CREATE POLICY "Super admins can manage all lockouts"
ON public.user_lockouts
FOR ALL
USING (is_super_admin());

CREATE POLICY "Org admins can view lockouts in their org"
ON public.user_lockouts
FOR SELECT
USING (
  user_id IN (
    SELECT upa.user_id FROM user_property_access upa
    WHERE upa.organization_id IN (
      SELECT upa2.organization_id FROM user_property_access upa2
      WHERE upa2.user_id = auth.uid() AND upa2.is_org_admin = true
    )
  )
);

CREATE POLICY "System can insert lockouts"
ON public.user_lockouts
FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update lockouts"
ON public.user_lockouts
FOR UPDATE
USING (true);