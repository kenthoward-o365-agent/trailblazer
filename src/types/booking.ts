import { CalculatedTax } from "@/lib/taxCalculations";

// ============================================
// Shared Booking Types
// ============================================

/**
 * Site enforcement requirements captured during booking.
 * Used to hard-block ineligible sites in the picker/auto-assign.
 */
export interface SiteRequirements {
  min_length?: number;
  needs_pull_through?: boolean;
  needs_50amp?: boolean;
  needs_30amp?: boolean;
  needs_bump_outs?: boolean;
  needs_shade?: boolean;
  needs_fire_pit?: boolean;
  needs_picnic_table?: boolean;
}

/**
 * Form data for the booking wizard
 */
export interface BookingFormData {
  checkIn: string;
  checkOut: string;
  siteType: string;
  guests: string;
  selectedSite: string;
  rateId: string;
  sourceOfBusinessId: string;
  title: string;
  firstName: string;
  lastName: string;
  streetAddress: string;
  city: string;
  state: string;
  zipcode: string;
  country: string;
  phone: string;
  phone2: string;
  email: string;
  birthday: string | null;     // Format: "MM-DD"
  anniversary: string | null;  // Format: "MM-DD"
  likesDislikes: string;
  siteRequirements?: SiteRequirements;
}

/**
 * Add-on selected for a reservation
 */
export interface SelectedAddOn {
  addOnId: string;
  quantity: number;
  isBundled?: boolean; // true if auto-added from rate bundle
}

/**
 * Guest matched from lookup
 */
export interface MatchedGuest {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  street_address: string | null;
  city: string | null;
  state: string | null;
  zipcode: string | null;
  country: string | null;
  birthday: string | null;
  anniversary: string | null;
  likes_dislikes: string | null;
  favorite_site_id: string | null;
}

/**
 * Quote calculation result - all price fields are numbers
 */
export interface QuoteDetails {
  siteTypeName: string;
  days: number;
  basePrice: number;
  seasonMultiplier: number;
  weekendMultiplier: number;
  losDiscount: number;
  subtotal: number;
  addOnsTotal: number;
  taxes: CalculatedTax[];
  totalTax: number;
  totalPrice: number;
}

/**
 * Site type definition
 */
export interface SiteType {
  id: string;
  name: string;
  base_price: number;
}

/**
 * Rate definition
 */
export interface Rate {
  id: string;
  rate_code: string;
  description: string | null;
  is_default?: boolean;
  is_base_rate?: boolean;
  base_rate_id?: string | null;
  adjustment_type?: string | null;
  adjustment_value?: number | null;
  revenue_account_id?: string | null;
}

/**
 * Source of business definition
 */
export interface SourceOfBusiness {
  id: string;
  code: string;
  definition: string;
  is_default?: boolean;
}

/**
 * Add-on definition
 */
export interface AddOn {
  id: string;
  code: string | null;
  name: string;
  description: string | null;
  price: number;
  charge_type?: string;
}

/**
 * City ledger account
 */
export interface CityLedger {
  id: string;
  company_name: string | null;
  account_number: string | null;
}

/**
 * Site definition
 */
export interface Site {
  id: string;
  site_number: string;
  site_type_id: string;
  site_types?: SiteType;
  is_active: boolean;
  max_occupancy: number;
  max_vehicle_length?: number | null;
  site_access_type?: string | null;
  is_shaded?: boolean | null;
  has_fire_pit?: boolean | null;
  has_picnic_table?: boolean | null;
  allows_bump_outs?: boolean | null;
  has_50amp?: boolean | null;
  has_30amp?: boolean | null;
}
