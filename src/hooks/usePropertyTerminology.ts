import { useProperty } from "@/contexts/PropertyContext";

export interface PropertyTerminology {
  // Singular terms
  site: string;
  siteType: string;
  siteNumber: string;
  siteMaintenance: string;

  // Plural terms
  sites: string;
  siteTypes: string;

  // Actions
  siteReady: string;
  siteNeedsInspection: string;

  // Property type checks (campground PMS — these are constants now)
  isHotel: boolean;
  isCampground: boolean;
  isTypeFloating: boolean;
  isUnitRequired: boolean;
}

export function usePropertyTerminology(): PropertyTerminology {
  // Trailblazer PMS is a campground-only product. Terminology is fixed.
  useProperty();
  return {
    site: 'Site',
    siteType: 'Site Type',
    siteNumber: 'Site Number',
    siteMaintenance: 'Site Turnover',
    sites: 'Sites',
    siteTypes: 'Site Types',
    siteReady: 'Ready',
    siteNeedsInspection: 'Needs Inspection',
    isHotel: false,
    isCampground: true,
    isTypeFloating: false,
    isUnitRequired: true,
  };
}
