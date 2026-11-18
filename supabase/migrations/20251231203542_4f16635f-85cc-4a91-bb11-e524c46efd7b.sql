-- Create change_journal table for tracking all operational changes
CREATE TABLE public.change_journal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  record_type text NOT NULL CHECK (record_type IN ('reservation', 'housekeeping')),
  record_id uuid NOT NULL,
  record_identifier text NOT NULL,
  field_name text NOT NULL,
  old_value text,
  new_value text,
  changed_by uuid,
  changed_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for fast queries
CREATE INDEX idx_change_journal_property ON public.change_journal(property_id);
CREATE INDEX idx_change_journal_created ON public.change_journal(created_at);
CREATE INDEX idx_change_journal_record ON public.change_journal(record_type, record_id);
CREATE INDEX idx_change_journal_identifier ON public.change_journal(record_identifier);

-- Enable RLS
ALTER TABLE public.change_journal ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their property's changes"
ON public.change_journal FOR SELECT
USING (user_has_property_access(property_id));

CREATE POLICY "Authenticated users can insert changes"
ON public.change_journal FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "System can delete old entries"
ON public.change_journal FOR DELETE
USING (user_has_property_access(property_id));