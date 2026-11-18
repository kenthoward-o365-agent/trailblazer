-- Add audit columns to housekeeping_assignments for tracking changes
ALTER TABLE public.housekeeping_assignments
ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS completed_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS status_history jsonb DEFAULT '[]'::jsonb;

-- Add index for efficient querying of assignment history
CREATE INDEX IF NOT EXISTS idx_housekeeping_assignments_date_property 
ON public.housekeeping_assignments(assignment_date, property_id);

-- Add comment explaining the status_history structure
COMMENT ON COLUMN public.housekeeping_assignments.status_history IS 
'Array of status changes: [{status, changed_at, changed_by, changed_by_name}]';