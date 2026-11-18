
CREATE SEQUENCE IF NOT EXISTS public.organization_client_number_seq START WITH 1000 INCREMENT BY 1 MINVALUE 1000;

ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS client_number INTEGER;

-- Backfill existing orgs deterministically by created_at
DO $$
DECLARE r RECORD; n INTEGER;
BEGIN
  FOR r IN SELECT id FROM public.organizations WHERE client_number IS NULL ORDER BY created_at, id LOOP
    n := nextval('public.organization_client_number_seq');
    UPDATE public.organizations SET client_number = n WHERE id = r.id;
  END LOOP;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS organizations_client_number_key ON public.organizations(client_number);
ALTER TABLE public.organizations ALTER COLUMN client_number SET NOT NULL;
ALTER TABLE public.organizations ALTER COLUMN client_number SET DEFAULT nextval('public.organization_client_number_seq');

-- Ensure sequence is ahead of any existing values
SELECT setval('public.organization_client_number_seq', GREATEST((SELECT COALESCE(MAX(client_number), 999) FROM public.organizations), 999));

CREATE OR REPLACE FUNCTION public.assign_organization_client_number()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.client_number IS NULL THEN
    NEW.client_number := nextval('public.organization_client_number_seq');
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS organizations_assign_client_number ON public.organizations;
CREATE TRIGGER organizations_assign_client_number
BEFORE INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.assign_organization_client_number();
