-- Create auto_run_logs table to track automatic night audit and day-end close executions
CREATE TABLE public.auto_run_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  run_type TEXT NOT NULL, -- 'night_audit', 'dayend_close', or 'full_cycle'
  status TEXT NOT NULL, -- 'success', 'error', 'skipped'
  message TEXT,
  audit_date DATE,
  folios_processed INTEGER,
  total_room_revenue NUMERIC(10,2),
  total_tax_revenue NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.auto_run_logs ENABLE ROW LEVEL SECURITY;

-- Create policy for property users to view their logs
CREATE POLICY "Users can view auto_run_logs for their properties" 
ON public.auto_run_logs 
FOR SELECT 
USING (
  property_id IN (
    SELECT property_id FROM public.user_property_access WHERE user_id = auth.uid()
  )
);

-- Allow edge functions to insert logs (service role)
CREATE POLICY "Service role can insert auto_run_logs"
ON public.auto_run_logs
FOR INSERT
WITH CHECK (true);

-- Add index for efficient queries
CREATE INDEX idx_auto_run_logs_property_date ON public.auto_run_logs(property_id, created_at DESC);