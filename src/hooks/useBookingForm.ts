import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { BookingFormData, MatchedGuest, SelectedAddOn } from "@/types/booking";
import type { Site } from "@/hooks/useBookingData";

export type { BookingFormData, MatchedGuest };

interface GroupBlock {
  code: string;
  description: string | null;
  allowOtherRoomTypes: boolean;
  hasMasterAccount: boolean;
  chargeRouting: string | null;
  cityLedgerAccountId: string | null;
}

export interface GroupBlockAllocation {
  site_type_id: string;
  rate_id: string | null;
  override_rate: number | null;
}

export interface GroupBlockSiteAllocation {
  site_id: string;
  rate_id: string | null;
  override_rate: number | null;
}

interface UseBookingFormProps {
  propertyCountry: string | undefined;
  setSites: (sites: Site[]) => void;
}

export const useBookingForm = ({ propertyCountry, setSites }: UseBookingFormProps) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState<BookingFormData>({
    checkIn: "",
    checkOut: "",
    siteType: "",
    guests: "2",
    selectedSite: "",
    rateId: "",
    sourceOfBusinessId: "",
    title: "",
    firstName: "",
    lastName: "",
    streetAddress: "",
    city: "",
    state: "",
    zipcode: "",
    country: propertyCountry || "US",
    phone: "",
    phone2: "",
    email: "",
    birthday: null,
    anniversary: null,
    likesDislikes: "",
  });

  const [selectedAddOns, setSelectedAddOns] = useState<SelectedAddOn[]>([]);
  const [selectedGuestId, setSelectedGuestId] = useState<string | null>(null);
  const [preselectedSite, setPreselectedSite] = useState<Site | null>(null);
  const [editReservationId, setEditReservationId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isFromBookingChart, setIsFromBookingChart] = useState(false);
  const [groupBlockId, setGroupBlockId] = useState<string | null>(null);
  const [groupBlock, setGroupBlock] = useState<GroupBlock | null>(null);
  const [groupBlockAllocations, setGroupBlockAllocations] = useState<GroupBlockAllocation[]>([]);
  const [groupBlockSiteAllocations, setGroupBlockSiteAllocations] = useState<GroupBlockSiteAllocation[]>([]);
  const [isRoomSpecificBlock, setIsRoomSpecificBlock] = useState(false);
  const [billToCompany, setBillToCompany] = useState(false);
  const [selectedCityLedgerId, setSelectedCityLedgerId] = useState("");
  const [billingInstructions, setBillingInstructions] = useState("");

  // Set default country from property when available
  useEffect(() => {
    if (propertyCountry && !isEditMode) {
      setFormData((prev) => ({
        ...prev,
        country: prev.country === "US" ? propertyCountry : prev.country,
      }));
    }
  }, [propertyCountry, isEditMode]);

  // Load group block with allocations
  const loadGroupBlock = async (blockId: string) => {
    // Fetch group block details including billing settings
    const { data, error } = await supabase
      .from("group_blocks")
      .select("code, description, start_date, end_date, allow_other_room_types, has_master_account, charge_routing, city_ledger_account_id")
      .eq("id", blockId)
      .single();

    if (error || !data) {
      toast.error("Could not load group block");
      return;
    }

    // Fetch distinct room type allocations with rate info
    const { data: typeAllocations } = await supabase
      .from("group_block_room_allocations")
      .select("site_type_id, rate_id, override_rate")
      .eq("group_block_id", blockId)
      .not("site_type_id", "is", null);

    // Fetch specific room allocations (site_id based)
    const { data: siteAllocations } = await supabase
      .from("group_block_room_allocations")
      .select("site_id, rate_id, override_rate")
      .eq("group_block_id", blockId)
      .not("site_id", "is", null);

    // Get unique allocations per site type (use first occurrence for rate info)
    const uniqueTypeAllocations = new Map<string, GroupBlockAllocation>();
    typeAllocations?.forEach((a) => {
      if (a.site_type_id && !uniqueTypeAllocations.has(a.site_type_id)) {
        uniqueTypeAllocations.set(a.site_type_id, {
          site_type_id: a.site_type_id,
          rate_id: a.rate_id,
          override_rate: a.override_rate,
        });
      }
    });

    // Get unique allocations per site (for room-specific blocks)
    const uniqueSiteAllocations = new Map<string, GroupBlockSiteAllocation>();
    siteAllocations?.forEach((a) => {
      if (a.site_id && !uniqueSiteAllocations.has(a.site_id)) {
        uniqueSiteAllocations.set(a.site_id, {
          site_id: a.site_id,
          rate_id: a.rate_id,
          override_rate: a.override_rate,
        });
      }
    });

    // Determine if this is a room-specific block (has site allocations but no type allocations)
    const hasTypeAllocations = uniqueTypeAllocations.size > 0;
    const hasSiteAllocations = uniqueSiteAllocations.size > 0;
    const roomSpecific = hasSiteAllocations && !hasTypeAllocations;

    setGroupBlockId(blockId);
    setGroupBlock({ 
      code: data.code, 
      description: data.description,
      allowOtherRoomTypes: data.allow_other_room_types ?? false,
      hasMasterAccount: data.has_master_account ?? false,
      chargeRouting: data.charge_routing,
      cityLedgerAccountId: data.city_ledger_account_id
    });
    setGroupBlockAllocations(Array.from(uniqueTypeAllocations.values()));
    setGroupBlockSiteAllocations(Array.from(uniqueSiteAllocations.values()));
    setIsRoomSpecificBlock(roomSpecific);

    // Pre-fill dates from group block if not already set
    if (!formData.checkIn && !formData.checkOut) {
      setFormData((prev) => ({
        ...prev,
        checkIn: data.start_date,
        checkOut: data.end_date,
      }));
    }

    // Auto-select city ledger for group bookings when:
    // 1. Group has master account enabled
    // 2. City ledger is linked to the group
    // 3. Charge routing is "all_charges" or "room_and_tax" (NOT "master_account_only")
    if (data.has_master_account && 
        data.city_ledger_account_id && 
        (data.charge_routing === 'all_charges' || data.charge_routing === 'room_and_tax')) {
      setBillToCompany(true);
      setSelectedCityLedgerId(data.city_ledger_account_id);
      
      // Set appropriate billing instructions based on charge routing
      if (data.charge_routing === 'room_and_tax') {
        setBillingInstructions("Room & Tax only. Guest responsible for incidentals.");
      } else {
        setBillingInstructions("All charges to be billed to company.");
      }
    }
  };

  // Load preselected site
  const loadPreselectedSite = async (siteId: string) => {
    const { data: site, error } = await supabase
      .from("sites")
      .select("*, site_types(*)")
      .eq("id", siteId)
      .single();

    if (error || !site) {
      toast.error("Could not load selected site");
      return null;
    }

    setPreselectedSite(site);
    setFormData((prev) => ({
      ...prev,
      siteType: site.site_type_id,
      selectedSite: site.id,
    }));
    setSites([site]);
    return site;
  };

  // Load edit reservation
  const loadEditReservation = async (
    reservationId: string,
    newSiteId: string | null,
    newCheckIn: string | null,
    newCheckOut: string | null,
    propertyId: string | undefined
  ) => {
    try {
      const { data: reservation, error } = await supabase
        .from("reservations")
        .select(`*, guests(*), sites(*, site_types(*))`)
        .eq("id", reservationId)
        .single();

      if (error || !reservation) {
        toast.error("Could not load reservation for editing");
        navigate("/booking-chart");
        return null;
      }

      setEditReservationId(reservationId);
      setIsEditMode(true);
      setSelectedGuestId(reservation.guest_id);

      // Load new site if provided
      let newSite = null;
      if (newSiteId) {
        const { data: site } = await supabase
          .from("sites")
          .select("*, site_types(*)")
          .eq("id", newSiteId)
          .single();

        if (site) {
          newSite = site;
          setPreselectedSite(site);
          setSites([site]);
        }
      }

      // Set form data
      setFormData({
        checkIn: newCheckIn || reservation.check_in_date,
        checkOut: newCheckOut || reservation.check_out_date,
        siteType: newSite?.site_type_id || reservation.sites?.site_type_id || "",
        selectedSite: newSiteId || reservation.site_id,
        guests: reservation.guests_count?.toString() || "2",
        rateId: reservation.rate_id || "",
        sourceOfBusinessId: reservation.source_of_business_id || "",
        title: reservation.guests?.title || "",
        firstName: reservation.guests?.first_name || "",
        lastName: reservation.guests?.last_name || "",
        email: reservation.guests?.email || "",
        phone: reservation.guests?.phone || "",
        phone2: reservation.guests?.phone2 || "",
        streetAddress: reservation.guests?.street_address || "",
        city: reservation.guests?.city || "",
        state: reservation.guests?.state || "",
        zipcode: reservation.guests?.zipcode || "",
        country: reservation.guests?.country || propertyCountry || "US",
        birthday: reservation.guests?.birthday || null,
        anniversary: reservation.guests?.anniversary || null,
        likesDislikes: reservation.guests?.likes_dislikes || "",
      });

      toast.info("Recalculating rate for the new dates/site...");
      return reservation;
    } catch (err) {
      console.error(err);
      toast.error("Failed to load reservation");
      navigate("/booking-chart");
      return null;
    }
  };

  // Handle URL parameters on mount
  useEffect(() => {
    const siteId = searchParams.get("site") || searchParams.get("site_id");
    const siteTypeId = searchParams.get("site_type_id");
    const checkIn = searchParams.get("check_in");
    const checkOut = searchParams.get("check_out");
    const editReservation = searchParams.get("edit_reservation");
    const groupBlockIdParam = searchParams.get("groupBlockId");

    if (editReservation) {
      // Edit mode will be handled by parent component after loading
      setEditReservationId(editReservation);
    } else if (siteId) {
      loadPreselectedSite(siteId);
      setIsFromBookingChart(true);
    }

    // Pre-select site type and dates from URL - this indicates coming from booking chart
    if (!editReservation && (siteTypeId || checkIn || checkOut)) {
      setFormData((prev) => ({
        ...prev,
        siteType: siteTypeId || prev.siteType,
        checkIn: checkIn || prev.checkIn,
        checkOut: checkOut || prev.checkOut,
      }));
      // If we have site type with dates, user came from booking chart
      if (siteTypeId && checkIn && checkOut) {
        setIsFromBookingChart(true);
      }
    }

    // Load group block if provided
    if (groupBlockIdParam) {
      loadGroupBlock(groupBlockIdParam);
    }
  }, [searchParams]);

  // Handle guest selection from lookup
  const handleGuestSelected = useCallback(async (guest: MatchedGuest | null) => {
    if (!guest) {
      setSelectedGuestId(null);
      return;
    }
    setSelectedGuestId(guest.id);
    setFormData((prev) => ({
      ...prev,
      firstName: guest.first_name,
      lastName: guest.last_name,
      email: guest.email,
      phone: guest.phone || "",
      streetAddress: guest.street_address || "",
      city: guest.city || "",
      state: guest.state || "",
      zipcode: guest.zipcode || "",
      country: guest.country || prev.country,
      birthday: guest.birthday || null,
      anniversary: guest.anniversary || null,
      likesDislikes: guest.likes_dislikes || "",
    }));

    // Check if guest has a favorite room and suggest it
    if (guest.favorite_site_id) {
      try {
        // Fetch the favorite site details
        const { data: favoriteSite } = await supabase
          .from("sites")
          .select("id, site_number, site_type_id, site_types (name)")
          .eq("id", guest.favorite_site_id)
          .eq("is_active", true)
          .single();

        if (favoriteSite) {
          // Check if we already have formData with check-in/out dates
          // and if the site type matches what's selected (or nothing is selected yet)
          setFormData((prev) => {
            const siteTypeMatches = !prev.siteType || prev.siteType === favoriteSite.site_type_id;
            const noSiteSelected = !prev.selectedSite;
            
            if (siteTypeMatches && noSiteSelected) {
              // Auto-suggest the favorite room
              toast.success(
                `Favorite room #${favoriteSite.site_number} suggested for ${guest.first_name}`,
                { duration: 4000 }
              );
              return {
                ...prev,
                selectedSite: favoriteSite.id,
                siteType: prev.siteType || favoriteSite.site_type_id,
              };
            }
            return prev;
          });
        }
      } catch (error) {
        // Silently fail - favorite room suggestion is a nice-to-have
        console.error("Failed to fetch favorite site:", error);
      }
    }
  }, []);

  // Add-on management
  const handleAddAddOn = (addOnId: string) => {
    const existing = selectedAddOns.find((s) => s.addOnId === addOnId);
    if (existing) {
      setSelectedAddOns(
        selectedAddOns.map((s) =>
          s.addOnId === addOnId ? { ...s, quantity: s.quantity + 1 } : s
        )
      );
    } else {
      setSelectedAddOns([...selectedAddOns, { addOnId, quantity: 1 }]);
    }
  };

  const handleRemoveAddOn = (addOnId: string) => {
    setSelectedAddOns(selectedAddOns.filter((s) => s.addOnId !== addOnId));
  };

  // Apply bundled add-ons from a rate (without duplicating existing selections)
  const applyBundledAddOns = (bundledAddOnIds: string[]) => {
    setSelectedAddOns(current => {
      // First, remove any previously bundled add-ons that are no longer in the new bundle
      const nonBundled = current.filter(a => !a.isBundled);
      const existingIds = nonBundled.map(a => a.addOnId);
      
      // Add new bundled add-ons that aren't already selected
      const newBundled = bundledAddOnIds
        .filter(id => !existingIds.includes(id))
        .map(id => ({ addOnId: id, quantity: 1, isBundled: true }));
      
      return [...nonBundled, ...newBundled];
    });
  };

  return {
    step,
    setStep,
    formData,
    setFormData,
    selectedAddOns,
    setSelectedAddOns,
    selectedGuestId,
    setSelectedGuestId,
    preselectedSite,
    setPreselectedSite,
    editReservationId,
    isEditMode,
    isFromBookingChart,
    groupBlockId,
    groupBlock,
    groupBlockAllocations,
    groupBlockSiteAllocations,
    isRoomSpecificBlock,
    billToCompany,
    setBillToCompany,
    selectedCityLedgerId,
    setSelectedCityLedgerId,
    billingInstructions,
    setBillingInstructions,
    handleGuestSelected,
    handleAddAddOn,
    handleRemoveAddOn,
    applyBundledAddOns,
    loadEditReservation,
    loadPreselectedSite,
    searchParams,
  };
};
