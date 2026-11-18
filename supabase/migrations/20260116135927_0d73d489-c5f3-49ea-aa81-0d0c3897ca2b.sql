-- Create admin access audit table for tracking internal staff property access
CREATE TABLE public.admin_access_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  admin_user_name TEXT NOT NULL,
  admin_role TEXT NOT NULL,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  property_name TEXT NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  organization_name TEXT,
  action TEXT NOT NULL CHECK (action IN ('access_started', 'access_ended')),
  session_id UUID NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX idx_admin_access_audit_admin ON admin_access_audit(admin_user_id);
CREATE INDEX idx_admin_access_audit_property ON admin_access_audit(property_id);
CREATE INDEX idx_admin_access_audit_session ON admin_access_audit(session_id);
CREATE INDEX idx_admin_access_audit_created ON admin_access_audit(created_at DESC);

-- Enable RLS
ALTER TABLE admin_access_audit ENABLE ROW LEVEL SECURITY;

-- Only internal users (super_admin, internal_admin) can view admin access audit
CREATE POLICY "Internal users can view admin access audit"
  ON admin_access_audit FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('super_admin', 'internal_admin')
    )
  );

-- Only internal users can insert admin access audit records
CREATE POLICY "Internal users can insert admin access audit"
  ON admin_access_audit FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_roles 
      WHERE user_id = auth.uid() 
      AND role IN ('super_admin', 'internal_admin')
    )
  );