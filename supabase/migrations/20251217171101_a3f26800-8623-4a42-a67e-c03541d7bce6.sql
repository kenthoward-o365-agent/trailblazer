-- Create api_keys table for inbound API authentication
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  key_name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_type TEXT NOT NULL DEFAULT 'live' CHECK (key_type IN ('live', 'test')),
  scopes JSONB DEFAULT '[]'::jsonb,
  rate_limit_per_minute INTEGER DEFAULT 60,
  is_active BOOLEAN DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  revoked_at TIMESTAMP WITH TIME ZONE
);

-- Create api_logs table for audit trail
CREATE TABLE public.api_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES public.api_keys(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER,
  response_time_ms INTEGER,
  ip_address TEXT,
  user_agent TEXT,
  request_body JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_api_keys_property_id ON public.api_keys(property_id);
CREATE INDEX idx_api_keys_key_prefix ON public.api_keys(key_prefix);
CREATE INDEX idx_api_keys_is_active ON public.api_keys(is_active) WHERE is_active = true;
CREATE INDEX idx_api_logs_api_key_id ON public.api_logs(api_key_id);
CREATE INDEX idx_api_logs_property_id ON public.api_logs(property_id);
CREATE INDEX idx_api_logs_created_at ON public.api_logs(created_at DESC);

-- Enable RLS
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for api_keys
CREATE POLICY "Property admins can view their API keys"
  ON public.api_keys FOR SELECT
  USING (user_has_property_access(property_id));

CREATE POLICY "Property admins can create API keys"
  ON public.api_keys FOR INSERT
  WITH CHECK (
    user_has_property_access(property_id) AND
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  );

CREATE POLICY "Property admins can update API keys"
  ON public.api_keys FOR UPDATE
  USING (
    user_has_property_access(property_id) AND
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  );

CREATE POLICY "Property admins can delete API keys"
  ON public.api_keys FOR DELETE
  USING (
    user_has_property_access(property_id) AND
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  );

-- RLS policies for api_logs (read-only for property admins, insert allowed for system)
CREATE POLICY "Property admins can view API logs"
  ON public.api_logs FOR SELECT
  USING (user_has_property_access(property_id));

CREATE POLICY "System can insert API logs"
  ON public.api_logs FOR INSERT
  WITH CHECK (true);