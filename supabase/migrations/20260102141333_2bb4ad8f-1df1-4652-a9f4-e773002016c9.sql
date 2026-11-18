-- Create System site type for each property and *Out pseudo-room
-- This is used for post-checkout adjustments

-- First, create System site type for each property (base_price 0 since it's not bookable)
INSERT INTO site_types (name, property_id, base_price, description, code)
SELECT 
  'System',
  p.id,
  0,
  'System pseudo-room type for post-checkout adjustments',
  'SYS'
FROM properties p
WHERE NOT EXISTS (
  SELECT 1 FROM site_types st WHERE st.property_id = p.id AND st.name = 'System'
);

-- Then, create *Out site for each property using the System site type
INSERT INTO sites (property_id, site_type_id, site_number, max_occupancy, is_active, housekeeping_status, occupancy_status)
SELECT 
  p.id,
  st.id,
  '*Out',
  99,
  true,
  'clean',
  'vacant'
FROM properties p
JOIN site_types st ON st.property_id = p.id AND st.name = 'System'
WHERE NOT EXISTS (
  SELECT 1 FROM sites s WHERE s.property_id = p.id AND s.site_number = '*Out'
);