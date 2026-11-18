-- Backfill organization_id and origin_property_id for guests missing these fields
-- This fixes RLS visibility for guests created before the organization fields were required

UPDATE guests g
SET 
  origin_property_id = COALESCE(g.origin_property_id, sub.property_id),
  organization_id = COALESCE(g.organization_id, sub.organization_id)
FROM (
  SELECT DISTINCT ON (r.guest_id)
    r.guest_id,
    r.property_id,
    p.organization_id
  FROM reservations r
  JOIN properties p ON r.property_id = p.id
  ORDER BY r.guest_id, r.created_at ASC
) sub
WHERE g.id = sub.guest_id
  AND (g.origin_property_id IS NULL OR g.organization_id IS NULL);