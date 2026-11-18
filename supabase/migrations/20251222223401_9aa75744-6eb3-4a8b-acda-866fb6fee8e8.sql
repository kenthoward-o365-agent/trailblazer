-- Add max_hours column to housekeeping_staff for tracking work capacity
ALTER TABLE public.housekeeping_staff 
ADD COLUMN max_hours numeric(4,2) DEFAULT 8.0;

-- Add comment for documentation
COMMENT ON COLUMN public.housekeeping_staff.max_hours IS 'Maximum hours this staff member can work per day for auto-assignment calculations';