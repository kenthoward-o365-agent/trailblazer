-- Phase 1a: Add super_admin role to existing enum
-- This must be in its own transaction before being used
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'super_admin';