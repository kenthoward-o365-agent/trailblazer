-- Update can_access_guest function to allow guest access when they have a reservation at the property
CREATE OR REPLACE FUNCTION public.can_access_guest(_guest_id uuid, _property_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  guest_org_id uuid;
  guest_origin_property uuid;
  property_org_id uuid;
BEGIN
  -- Super admins can access all guests
  IF is_super_admin() THEN RETURN TRUE; END IF;

  -- Get guest's organization and origin property
  SELECT organization_id, origin_property_id INTO guest_org_id, guest_origin_property
  FROM guests WHERE id = _guest_id;

  -- Get property's organization
  SELECT organization_id INTO property_org_id
  FROM properties WHERE id = _property_id;

  -- If guest has no organization (legacy), allow access based on property access
  IF guest_org_id IS NULL THEN
    RETURN user_has_property_access(_property_id);
  END IF;

  -- If guest is from the same property, allow access
  IF guest_origin_property = _property_id THEN
    RETURN user_has_property_access(_property_id);
  END IF;

  -- If guest has a reservation at this property, allow access
  IF EXISTS (
    SELECT 1 FROM reservations
    WHERE guest_id = _guest_id
    AND property_id = _property_id
  ) THEN
    RETURN user_has_property_access(_property_id);
  END IF;

  -- Check if properties are in the same sharing group
  IF EXISTS (
    SELECT 1 
    FROM guest_sharing_group_members gsgm1
    JOIN guest_sharing_group_members gsgm2 ON gsgm1.group_id = gsgm2.group_id
    WHERE gsgm1.property_id = guest_origin_property
    AND gsgm2.property_id = _property_id
  ) THEN
    RETURN user_has_property_access(_property_id);
  END IF;

  RETURN FALSE;
END;
$function$;