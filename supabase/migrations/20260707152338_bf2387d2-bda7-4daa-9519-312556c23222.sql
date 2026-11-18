
CREATE TABLE public.onboarding_progress (
  property_id UUID PRIMARY KEY REFERENCES public.properties(id) ON DELETE CASCADE,
  steps JSONB NOT NULL DEFAULT '{}'::jsonb,
  current_step TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.onboarding_progress TO authenticated;
GRANT ALL ON public.onboarding_progress TO service_role;

ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Property members can view onboarding progress"
  ON public.onboarding_progress FOR SELECT
  TO authenticated
  USING (public.user_has_property_access(property_id));

CREATE POLICY "Property members can upsert onboarding progress"
  ON public.onboarding_progress FOR INSERT
  TO authenticated
  WITH CHECK (public.user_has_property_access(property_id));

CREATE POLICY "Property members can update onboarding progress"
  ON public.onboarding_progress FOR UPDATE
  TO authenticated
  USING (public.user_has_property_access(property_id))
  WITH CHECK (public.user_has_property_access(property_id));

CREATE POLICY "Property members can delete onboarding progress"
  ON public.onboarding_progress FOR DELETE
  TO authenticated
  USING (public.user_has_property_access(property_id));

CREATE TRIGGER trg_onboarding_progress_updated_at
  BEFORE UPDATE ON public.onboarding_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
