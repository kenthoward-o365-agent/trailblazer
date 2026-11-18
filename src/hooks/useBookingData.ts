import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface Rate {
  id: string;
  rate_code: string;
  description: string | null;
  start_date: string;
  end_date: string;
  is_base_rate: boolean;
  base_rate_id: string | null;
  revenue_account_id: string | null;
  is_default: boolean;
  adjustment_type: string | null;
  adjustment_value: number | null;
}

export interface SourceOfBusiness {
  id: string;
  code: string;
  definition: string;
  is_default: boolean;
}

export interface AddOn {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price: number;
  account_id: string | null;
  charge_type: string;
}

export interface CityLedger {
  id: string;
  company_name: string | null;
  account_number: string | null;
}

export interface SiteType {
  id: string;
  name: string;
  base_price: number;
}

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

export interface SiteRequirementsFilter {
  min_length?: number;
  needs_pull_through?: boolean;
  needs_50amp?: boolean;
  needs_30amp?: boolean;
  needs_bump_outs?: boolean;
  needs_shade?: boolean;
  needs_fire_pit?: boolean;
  needs_picnic_table?: boolean;
}

export function siteMeetsRequirements(site: Site, req?: SiteRequirementsFilter | null): boolean {
  if (!req) return true;
  if (req.min_length && Number(site.max_vehicle_length ?? 0) < req.min_length) return false;
  if (req.needs_pull_through && site.site_access_type !== "pull_through") return false;
  if (req.needs_50amp && !site.has_50amp) return false;
  if (req.needs_30amp && !site.has_30amp) return false;
  if (req.needs_bump_outs && !site.allows_bump_outs) return false;
  if (req.needs_shade && !site.is_shaded) return false;
  if (req.needs_fire_pit && !site.has_fire_pit) return false;
  if (req.needs_picnic_table && !site.has_picnic_table) return false;
  return true;
}

interface UseBookingDataProps {
  propertyId: string | undefined;
}

export const useBookingData = ({ propertyId }: UseBookingDataProps) => {
  const [siteTypes, setSiteTypes] = useState<SiteType[]>([]);
  const [defaultRatePrices, setDefaultRatePrices] = useState<Record<string, number>>({});
  const [rates, setRates] = useState<Rate[]>([]);
  const [sourcesOfBusiness, setSourcesOfBusiness] = useState<SourceOfBusiness[]>([]);
  const [availableAddOns, setAvailableAddOns] = useState<AddOn[]>([]);
  const [cityLedgers, setCityLedgers] = useState<CityLedger[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch site types and default rate prices (excludes System type for *Out)
  useEffect(() => {
    const fetchSiteTypesAndDefaultPrices = async () => {
      if (!propertyId) return;

      const { data, error } = await supabase
        .from("site_types")
        .select("id, name, base_price")
        .eq("property_id", propertyId)
        .neq("name", "System") // Exclude System type used for *Out
        .order("name");

      if (error) {
        console.error("Failed to fetch site types:", error);
        return;
      }

      setSiteTypes(data || []);

      // Fetch default rate and its prices
      const { data: defaultRate } = await supabase
        .from("rates")
        .select("id")
        .eq("property_id", propertyId)
        .eq("is_default", true)
        .single();

      if (defaultRate) {
        const { data: prices } = await supabase
          .from("rate_site_type_prices")
          .select("site_type_id, price")
          .eq("rate_id", defaultRate.id);

        if (prices) {
          const priceMap: Record<string, number> = {};
          prices.forEach((p) => {
            priceMap[p.site_type_id] = p.price;
          });
          setDefaultRatePrices(priceMap);
        }
      }
    };

    fetchSiteTypesAndDefaultPrices();
  }, [propertyId]);

  // Fetch sources of business
  const fetchSourcesOfBusiness = async () => {
    if (!propertyId) return null;

    const { data, error } = await supabase
      .from("source_of_business")
      .select("id, code, definition, is_default")
      .eq("property_id", propertyId)
      .order("code");

    if (error) {
      console.error("Failed to fetch sources of business:", error);
      return null;
    }

    setSourcesOfBusiness(data || []);
    return data;
  };

  // Fetch add-ons
  const fetchAddOns = async () => {
    if (!propertyId) return;

    const { data, error } = await supabase
      .from("add_ons")
      .select("id, code, name, description, price, account_id, charge_type")
      .eq("property_id", propertyId)
      .eq("is_active", true)
      .order("code");

    if (error) {
      console.error("Failed to fetch add-ons:", error);
      return;
    }

    setAvailableAddOns(data || []);
  };

  // Fetch city ledgers
  const fetchCityLedgers = async () => {
    if (!propertyId) return;

    const { data } = await supabase
      .from("ledger_accounts")
      .select("id, company_name, account_number")
      .eq("property_id", propertyId)
      .eq("ledger_type", "city")
      .eq("is_active", true)
      .order("company_name");

    setCityLedgers(data || []);
  };

  // Fetch rates for date range
  const fetchAvailableRates = async (checkIn: string, checkOut: string) => {
    if (!checkIn || !checkOut || !propertyId) return null;

    const { data, error } = await supabase
      .from("rates")
      .select(
        "id, rate_code, description, start_date, end_date, is_base_rate, base_rate_id, revenue_account_id, is_default, adjustment_type, adjustment_value"
      )
      .eq("property_id", propertyId)
      .lte("start_date", checkIn)
      .gte("end_date", checkOut)
      .order("rate_code");

    if (error) {
      console.error("Failed to fetch rates:", error);
      return null;
    }

    setRates(data || []);
    return data;
  };

  const SITE_ATTR_COLS =
    "id, site_number, site_type_id, is_active, max_occupancy, max_vehicle_length, site_access_type, is_shaded, has_fire_pit, has_picnic_table, allows_bump_outs, has_50amp, has_30amp, site_types(*)";

  // Fetch sites for site type (excludes system *Out site).
  // Optional `requirements` hard-blocks ineligible sites so staff cannot pick them.
  const fetchSites = async (siteTypeId: string, requirements?: SiteRequirementsFilter | null) => {
    if (!siteTypeId) return;

    setLoading(true);
    const { data, error } = await supabase
      .from("sites")
      .select(SITE_ATTR_COLS)
      .eq("site_type_id", siteTypeId)
      .eq("is_active", true)
      .neq("site_number", "*Out"); // Exclude system *Out site

    setLoading(false);

    if (error) {
      console.error("Failed to fetch sites:", error);
      return;
    }

    const filtered = (data || []).filter((s: any) => siteMeetsRequirements(s as Site, requirements));
    setSites(filtered as Site[]);
  };

  // Load site by ID
  const loadSiteById = async (siteId: string) => {
    const { data, error } = await supabase
      .from("sites")
      .select("*, site_types(*)")
      .eq("id", siteId)
      .single();

    if (error) {
      console.error("Failed to load site:", error);
      return null;
    }

    return data;
  };

  // Fetch specific sites by their IDs (for room-specific group blocks, excludes *Out)
  const fetchSitesByIds = async (siteIds: string[]) => {
    if (siteIds.length === 0) return [];

    const { data, error } = await supabase
      .from("sites")
      .select(SITE_ATTR_COLS)
      .in("id", siteIds)
      .eq("is_active", true)
      .neq("site_number", "*Out"); // Exclude system *Out site

    if (error) {
      console.error("Failed to fetch sites by IDs:", error);
      return [];
    }

    setSites((data || []) as Site[]);
    return data || [];
  };

  // Fetch bundled add-ons for a rate
  const fetchRateBundledAddOns = async (rateId: string): Promise<string[]> => {
    if (!rateId) return [];

    const { data, error } = await supabase
      .from("rate_add_ons")
      .select("add_on_id")
      .eq("rate_id", rateId);

    if (error) {
      console.error("Failed to fetch rate bundled add-ons:", error);
      return [];
    }

    return (data || []).map(ra => ra.add_on_id);
  };

  // Load initial data when property changes
  useEffect(() => {
    if (propertyId) {
      fetchSourcesOfBusiness();
      fetchAddOns();
      fetchCityLedgers();
    }
  }, [propertyId]);

  return {
    siteTypes,
    defaultRatePrices,
    rates,
    setRates,
    sourcesOfBusiness,
    availableAddOns,
    cityLedgers,
    sites,
    setSites,
    loading,
    fetchAvailableRates,
    fetchSites,
    fetchSitesByIds,
    loadSiteById,
    fetchSourcesOfBusiness,
    fetchRateBundledAddOns,
  };
};
