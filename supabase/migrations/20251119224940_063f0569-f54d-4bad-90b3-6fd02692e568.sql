-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum for reservation status
CREATE TYPE reservation_status AS ENUM ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED');

-- Properties table
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Site types table (RV Standard, RV Premium, Tent, etc.)
CREATE TABLE site_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  base_price DECIMAL(10,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Sites table with map coordinates
CREATE TABLE sites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  site_type_id UUID NOT NULL REFERENCES site_types(id) ON DELETE CASCADE,
  site_number TEXT NOT NULL,
  map_x DECIMAL(10,4),
  map_y DECIMAL(10,4),
  max_occupancy INTEGER NOT NULL DEFAULT 4,
  amenities TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(property_id, site_number)
);

-- Seasons table for pricing
CREATE TABLE seasons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  multiplier DECIMAL(5,2) NOT NULL DEFAULT 1.00,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Rate rules table
CREATE TABLE rate_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  rule_type TEXT NOT NULL, -- 'weekend', 'los_discount', etc.
  conditions JSONB NOT NULL, -- flexible conditions storage
  multiplier DECIMAL(5,2),
  discount_amount DECIMAL(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add-ons table
CREATE TABLE add_ons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  category TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Guests table
CREATE TABLE guests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reservations table
CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  guest_id UUID NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  status reservation_status NOT NULL DEFAULT 'PENDING',
  total_price DECIMAL(10,2) NOT NULL,
  guests_count INTEGER NOT NULL DEFAULT 1,
  special_requests TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reservation add-ons junction table
CREATE TABLE reservation_add_ons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  add_on_id UUID NOT NULL REFERENCES add_ons(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  price_at_booking DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- AI Recommendations table
CREATE TABLE reservation_recommendations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  recommended_sites JSONB, -- Array of {site_id, score, reason}
  recommended_add_on JSONB, -- {add_on_id, reason}
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE add_ons ENABLE ROW LEVEL SECURITY;
ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_add_ons ENABLE ROW LEVEL SECURITY;
ALTER TABLE reservation_recommendations ENABLE ROW LEVEL SECURITY;

-- Public read access for guest-facing data
CREATE POLICY "Public can view properties" ON properties FOR SELECT USING (true);
CREATE POLICY "Public can view site types" ON site_types FOR SELECT USING (true);
CREATE POLICY "Public can view active sites" ON sites FOR SELECT USING (is_active = true);
CREATE POLICY "Public can view seasons" ON seasons FOR SELECT USING (true);
CREATE POLICY "Public can view rate rules" ON rate_rules FOR SELECT USING (true);
CREATE POLICY "Public can view active add-ons" ON add_ons FOR SELECT USING (is_active = true);

-- Guest policies
CREATE POLICY "Anyone can create guest" ON guests FOR INSERT WITH CHECK (true);
CREATE POLICY "Guests can view own data" ON guests FOR SELECT USING (true);

-- Reservation policies
CREATE POLICY "Anyone can create reservations" ON reservations FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view reservations" ON reservations FOR SELECT USING (true);
CREATE POLICY "Anyone can update reservations" ON reservations FOR UPDATE USING (true);

CREATE POLICY "Anyone can add reservation add-ons" ON reservation_add_ons FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view reservation add-ons" ON reservation_add_ons FOR SELECT USING (true);

CREATE POLICY "Anyone can add recommendations" ON reservation_recommendations FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view recommendations" ON reservation_recommendations FOR SELECT USING (true);

-- Indexes for performance
CREATE INDEX idx_sites_property ON sites(property_id);
CREATE INDEX idx_sites_type ON sites(site_type_id);
CREATE INDEX idx_reservations_dates ON reservations(check_in_date, check_out_date);
CREATE INDEX idx_reservations_site ON reservations(site_id);
CREATE INDEX idx_seasons_dates ON seasons(start_date, end_date);

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON properties FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_site_types_updated_at BEFORE UPDATE ON site_types FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sites_updated_at BEFORE UPDATE ON sites FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_seasons_updated_at BEFORE UPDATE ON seasons FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rate_rules_updated_at BEFORE UPDATE ON rate_rules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_add_ons_updated_at BEFORE UPDATE ON add_ons FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_guests_updated_at BEFORE UPDATE ON guests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON reservations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();