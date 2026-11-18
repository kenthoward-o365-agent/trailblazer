import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { BookingFormData } from "./useBookingForm";
import { QuoteDetails } from "./useQuoteCalculation";
import { AddOn } from "./useBookingData";
import { format, eachDayOfInterval, parseISO } from "date-fns";
import { logChange, getCurrentUserInfo } from "@/lib/changeJournal";

interface SelectedAddOn {
  addOnId: string;
  quantity: number;
}

interface UseReservationMutationProps {
  propertyId: string | undefined;
  organizationId: string | undefined;
}

interface AvailabilityResult {
  available: number;
  total: number;
  reservedCount: number;
  groupBlockedCount: number;
}

// Check availability for a site type across a date range
// If groupBlockId is provided, we're booking for that group block, so use its allocation
const checkAvailability = async (
  propertyId: string,
  siteTypeId: string,
  checkIn: string,
  checkOut: string,
  excludeReservationId?: string,
  groupBlockId?: string | null
): Promise<AvailabilityResult> => {
  // 1. Get total rooms for site type
  const { count: totalRooms } = await supabase
    .from("sites")
    .select("id", { count: "exact" })
    .eq("site_type_id", siteTypeId)
    .eq("property_id", propertyId)
    .eq("is_active", true);

  // 2. Count overlapping reservations (excluding cancelled/no-show)
  let reservationQuery = supabase
    .from("reservations")
    .select("id", { count: "exact" })
    .eq("site_type_id", siteTypeId)
    .eq("property_id", propertyId)
    .not("status", "in", '("CANCELLED","NO_SHOW")')
    .lt("check_in_date", checkOut)
    .gt("check_out_date", checkIn);

  if (excludeReservationId) {
    reservationQuery = reservationQuery.neq("id", excludeReservationId);
  }

  const { count: reservedCount } = await reservationQuery;

  // 3. Handle group block availability differently
  if (groupBlockId) {
    // When booking for a specific group block, check availability WITHIN the group's allocation
    
    // Get this group's allocation for the site type across the date range
    const { data: thisGroupAllocation } = await supabase
      .from("group_block_room_allocations")
      .select("rooms_blocked, allocation_date")
      .eq("group_block_id", groupBlockId)
      .eq("site_type_id", siteTypeId)
      .gte("allocation_date", checkIn)
      .lt("allocation_date", checkOut);

    // Count existing reservations for THIS group block (to see how many of the allocation is used)
    const { count: groupReservationsCount } = await supabase
      .from("reservations")
      .select("id", { count: "exact" })
      .eq("group_block_id", groupBlockId)
      .eq("site_type_id", siteTypeId)
      .not("status", "in", '("CANCELLED","NO_SHOW")')
      .lt("check_in_date", checkOut)
      .gt("check_out_date", checkIn);

    // Find minimum available within group allocation (bottleneck date)
    const minGroupAllocation = thisGroupAllocation?.reduce((min, alloc) => 
      Math.min(min, alloc.rooms_blocked), Infinity) || 0;
    
    const groupAvailable = minGroupAllocation - (groupReservationsCount || 0);

    return {
      available: Math.max(0, groupAvailable),
      total: minGroupAllocation,
      reservedCount: groupReservationsCount || 0,
      groupBlockedCount: 0, // Not relevant for group block bookings
    };
  }

  // 4. Standard availability check - get group block allocations and find max blocked
  const { data: groupBlocks } = await supabase
    .from("group_block_room_allocations")
    .select(`
      rooms_blocked,
      allocation_date,
      site_type_id,
      group_blocks!inner (status)
    `)
    .eq("site_type_id", siteTypeId)
    .in("group_blocks.status", ["active", "definite"])
    .gte("allocation_date", checkIn)
    .lt("allocation_date", checkOut);

  // Find max rooms blocked on any single date
  const maxGroupBlocked = groupBlocks?.reduce((max, alloc) => 
    Math.max(max, alloc.rooms_blocked), 0) || 0;

  const available = (totalRooms || 0) - (reservedCount || 0) - maxGroupBlocked;
  
  return {
    available,
    total: totalRooms || 0,
    reservedCount: reservedCount || 0,
    groupBlockedCount: maxGroupBlocked,
  };
};

export const useReservationMutation = ({
  propertyId,
  organizationId,
}: UseReservationMutationProps) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const createOrUpdateReservation = async (params: {
    formData: BookingFormData;
    quote: QuoteDetails;
    selectedGuestId: string | null;
    isEditMode: boolean;
    editReservationId: string | null;
    selectedAddOns: SelectedAddOn[];
    availableAddOns: AddOn[];
    groupBlockId: string | null;
    billToCompany: boolean;
    selectedCityLedgerId: string;
    billingInstructions: string;
    groupBlockOverrideRate?: number | null;
  }): Promise<boolean> => {
    const {
      formData,
      quote,
      selectedGuestId,
      isEditMode,
      editReservationId,
      selectedAddOns,
      availableAddOns,
      groupBlockId,
      billToCompany,
      selectedCityLedgerId,
      billingInstructions,
      groupBlockOverrideRate,
    } = params;

    if (!propertyId) {
      toast.error("No property selected");
      return false;
    }

    setLoading(true);

    try {
      let guestId = selectedGuestId;

      // If a guest was selected from lookup, update their organization fields and personal details
      if (selectedGuestId && organizationId && propertyId) {
        await supabase
          .from("guests")
          .update({
            organization_id: organizationId,
            origin_property_id: propertyId,
            // Also update personal details when saving reservation
            birthday: formData.birthday || null,
            anniversary: formData.anniversary || null,
            likes_dislikes: formData.likesDislikes || null,
          })
          .eq("id", selectedGuestId);
      }

      // If no guest was selected from lookup, create or find by email
      if (!guestId) {
        const { data: existingGuest } = await supabase
          .from("guests")
          .select("id")
          .eq("email", formData.email)
          .maybeSingle();

        if (existingGuest) {
          guestId = existingGuest.id;
          // Update guest with organization info and personal details
          await supabase
            .from("guests")
            .update({
              organization_id: organizationId,
              origin_property_id: propertyId,
              birthday: formData.birthday || null,
              anniversary: formData.anniversary || null,
              likes_dislikes: formData.likesDislikes || null,
            })
            .eq("id", existingGuest.id);
        } else {
          const { data: newGuest, error: guestError } = await supabase
            .from("guests")
            .insert({
              email: formData.email,
              first_name: formData.firstName,
              last_name: formData.lastName,
              title: formData.title || null,
              street_address: formData.streetAddress || null,
              city: formData.city || null,
              state: formData.state || null,
              zipcode: formData.zipcode || null,
              country: formData.country || null,
              phone: formData.phone || null,
              phone2: formData.phone2 || null,
              birthday: formData.birthday || null,
              anniversary: formData.anniversary || null,
              likes_dislikes: formData.likesDislikes || null,
              organization_id: organizationId,
              origin_property_id: propertyId,
            })
            .select()
            .single();

          if (guestError) throw guestError;
          guestId = newGuest.id;
        }
      }

      if (isEditMode && editReservationId) {
        // Update existing reservation
        const { error: updateError } = await supabase
          .from("reservations")
          .update({
            site_id: formData.selectedSite || null,
            site_type_id: formData.siteType || null,
            check_in_date: formData.checkIn,
            check_out_date: formData.checkOut,
            total_price: quote.totalPrice,
            guests_count: parseInt(formData.guests),
            rate_id: formData.rateId || null,
            source_of_business_id: formData.sourceOfBusinessId || null,
          })
          .eq("id", editReservationId);

        if (updateError) throw updateError;

        // Update add-ons
        await supabase
          .from("reservation_add_ons")
          .delete()
          .eq("reservation_id", editReservationId);

        if (selectedAddOns.length > 0) {
          const addOnsToInsert = selectedAddOns.map((sa) => {
            const addon = availableAddOns.find((a) => a.id === sa.addOnId);
            return {
              reservation_id: editReservationId,
              property_id: propertyId!,
              add_on_id: sa.addOnId,
              quantity: sa.quantity,
              price_at_booking: addon?.price || 0,
            };
          });
          await supabase.from("reservation_add_ons").insert(addOnsToInsert);
        }

        toast.success("Reservation updated! Redirecting...");
        setTimeout(() => {
          navigate("/booking-chart");
        }, 1500);
      } else {
        // Check availability before creating reservation
        if (formData.siteType) {
          const availability = await checkAvailability(
            propertyId,
            formData.siteType,
            formData.checkIn,
            formData.checkOut,
            undefined,
            groupBlockId
          );

          if (availability.available <= 0) {
            let message: string;
            if (groupBlockId) {
              // Booking for a group block - show group-specific message
              message = `No rooms available in the group block allocation. ${availability.total} rooms allocated, ${availability.reservedCount} already booked for the group.`;
            } else if (availability.groupBlockedCount > 0) {
              message = `No rooms available. ${availability.total} total rooms: ${availability.reservedCount} reserved, ${availability.groupBlockedCount} blocked by group.`;
            } else {
              message = `No rooms available. All ${availability.total} rooms are reserved for these dates.`;
            }
            toast.error(message);
            setLoading(false);
            return false;
          }
        }

        // Create new reservation
        // If using group block override rate, clear the rate_id and store override_rate
        const useOverrideRate = groupBlockOverrideRate !== null && groupBlockOverrideRate !== undefined;
        
        const { data: reservation, error: reservationError } = await supabase
          .from("reservations")
          .insert({
            property_id: propertyId,
            site_id: formData.selectedSite || null,
            site_type_id: formData.siteType || null,
            guest_id: guestId,
            check_in_date: formData.checkIn,
            check_out_date: formData.checkOut,
            status: "PENDING",
            total_price: quote.totalPrice,
            guests_count: parseInt(formData.guests),
            rate_id: useOverrideRate ? null : (formData.rateId || null),
            override_rate: useOverrideRate ? groupBlockOverrideRate : null,
            source_of_business_id: formData.sourceOfBusinessId || null,
            group_block_id: groupBlockId || null,
            city_ledger_account_id:
              billToCompany && selectedCityLedgerId ? selectedCityLedgerId : null,
            billing_instructions: billToCompany ? billingInstructions || null : null,
          })
          .select()
          .single();

        if (reservationError) throw reservationError;

        // Create the primary reservation_guest record
        const { data: reservationGuest, error: rgError } = await supabase
          .from("reservation_guests")
          .insert({
            reservation_id: reservation.id,
            property_id: propertyId!,
            guest_id: guestId,
            folio_number: 1,
            guest_confirmation_number: reservation.confirmation_number,
            is_primary: true,
          })
          .select()
          .single();

        if (rgError) {
          console.error("Error creating reservation_guest:", rgError);
          // Don't throw - this is for backward compatibility
        }

        // Create guest ledger account linked to the reservation_guest
        if (reservationGuest) {
          const { error: ledgerError } = await supabase
            .from("ledger_accounts")
            .insert({
              property_id: propertyId,
              reservation_id: reservation.id,
              reservation_guest_id: reservationGuest.id,
              guest_id: guestId,
              ledger_type: "guest",
              balance: 0,
              is_active: true,
            });
          
          if (ledgerError) {
            console.error("Error creating ledger account:", ledgerError);
          }
        }

        // Save add-ons
        if (selectedAddOns.length > 0) {
          const addOnsToInsert = selectedAddOns.map((sa) => {
            const addon = availableAddOns.find((a) => a.id === sa.addOnId);
            return {
              reservation_id: reservation.id,
              property_id: propertyId!,
              add_on_id: sa.addOnId,
              quantity: sa.quantity,
              price_at_booking: addon?.price || 0,
            };
          });
          await supabase.from("reservation_add_ons").insert(addOnsToInsert);
        }

        // Log reservation creation to change journal
        const userInfo = await getCurrentUserInfo();
        await logChange({
          propertyId,
          recordType: "reservation",
          recordId: reservation.id,
          recordIdentifier: reservation.confirmation_number,
          fieldName: "reservation_created",
          oldValue: null,
          newValue: "Created",
          userId: userInfo.userId,
          userName: userInfo.userName,
        });

        toast.success("Reservation created! Redirecting to confirmation...");
        setTimeout(() => {
          navigate(`/confirm/${reservation.id}`);
        }, 1500);
      }

      setLoading(false);
      return true;
    } catch (error) {
      console.error(error);
      toast.error(
        isEditMode ? "Failed to update reservation" : "Failed to create reservation"
      );
      setLoading(false);
      return false;
    }
  };

  return {
    loading,
    createOrUpdateReservation,
  };
};
