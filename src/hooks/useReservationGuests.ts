import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface ReservationGuest {
  id: string;
  reservation_id: string;
  guest_id: string;
  folio_number: number;
  guest_confirmation_number: string;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
  guest?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    phone2: string | null;
    title: string | null;
    street_address: string | null;
    city: string | null;
    state: string | null;
    zipcode: string | null;
    country: string | null;
    birthday: string | null;
    anniversary: string | null;
    likes_dislikes: string | null;
  };
  ledger_account?: {
    id: string;
    balance: number;
    ledger_type: string;
  } | null;
}

interface UseReservationGuestsProps {
  reservationId: string | undefined;
}

export const useReservationGuests = ({ reservationId }: UseReservationGuestsProps) => {
  const [reservationGuests, setReservationGuests] = useState<ReservationGuest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const MAX_GUESTS = 4;

  const loadReservationGuests = useCallback(async () => {
    if (!reservationId) {
      setReservationGuests([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from("reservation_guests")
        .select(`
          *,
          guest:guests(*),
          ledger_account:ledger_accounts!ledger_accounts_reservation_guest_id_fkey(id, balance, ledger_type)
        `)
        .eq("reservation_id", reservationId)
        .order("folio_number", { ascending: true });

      if (fetchError) throw fetchError;

      // Transform the data - ledger_account comes back as an array, we want a single object
      const transformedData = (data || []).map(rg => ({
        ...rg,
        ledger_account: Array.isArray(rg.ledger_account) 
          ? rg.ledger_account.find((la: { ledger_type: string }) => la.ledger_type === 'guest') || null
          : rg.ledger_account
      }));

      setReservationGuests(transformedData as ReservationGuest[]);
    } catch (err) {
      console.error("Error loading reservation guests:", err);
      setError("Failed to load reservation guests");
    } finally {
      setLoading(false);
    }
  }, [reservationId]);

  useEffect(() => {
    loadReservationGuests();
  }, [loadReservationGuests]);

  const addGuest = async (guestId: string, propertyId: string): Promise<boolean> => {
    if (!reservationId) {
      toast.error("No reservation selected");
      return false;
    }

    if (reservationGuests.length >= MAX_GUESTS) {
      toast.error(`Maximum of ${MAX_GUESTS} guests per reservation`);
      return false;
    }

    // Check if guest is already on this reservation
    const existingGuest = reservationGuests.find(rg => rg.guest_id === guestId);
    if (existingGuest) {
      toast.error("This guest is already on the reservation");
      return false;
    }

    try {
      // Get the reservation's confirmation number and property
      const { data: reservation, error: resError } = await supabase
        .from("reservations")
        .select("confirmation_number, property_id")
        .eq("id", reservationId)
        .single();

      if (resError) throw resError;

      // Calculate next folio number
      const nextFolioNumber = reservationGuests.length + 1;

      // Generate guest confirmation number (e.g., RES-12345-2)
      const guestConfirmationNumber = nextFolioNumber === 1
        ? reservation.confirmation_number
        : `${reservation.confirmation_number}-${nextFolioNumber}`;

      // Insert the reservation_guest record
      const { data: newReservationGuest, error: insertError } = await supabase
        .from("reservation_guests")
        .insert({
          reservation_id: reservationId,
          property_id: propertyId,
          guest_id: guestId,
          folio_number: nextFolioNumber,
          guest_confirmation_number: guestConfirmationNumber,
          is_primary: nextFolioNumber === 1,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Create a guest ledger account for this reservation_guest
      const { data: ledgerAccount, error: ledgerError } = await supabase
        .from("ledger_accounts")
        .insert({
          property_id: propertyId,
          reservation_id: reservationId,
          reservation_guest_id: newReservationGuest.id,
          guest_id: guestId,
          ledger_type: "guest",
          balance: 0,
          is_active: true,
        })
        .select()
        .single();

      if (ledgerError) throw ledgerError;

      toast.success(`Guest added with confirmation ${guestConfirmationNumber}`);
      await loadReservationGuests();
      return true;
    } catch (err) {
      console.error("Error adding guest:", err);
      toast.error("Failed to add guest to reservation");
      return false;
    }
  };

  const removeGuest = async (reservationGuestId: string): Promise<boolean> => {
    const guestToRemove = reservationGuests.find(rg => rg.id === reservationGuestId);
    
    if (!guestToRemove) {
      toast.error("Guest not found");
      return false;
    }

    if (guestToRemove.is_primary) {
      toast.error("Cannot remove the primary guest");
      return false;
    }

    // Check if the guest's folio has a balance
    if (guestToRemove.ledger_account && guestToRemove.ledger_account.balance !== 0) {
      toast.error("Cannot remove guest with outstanding folio balance. Transfer charges first.");
      return false;
    }

    try {
      // Delete associated ledger accounts first
      await supabase
        .from("ledger_accounts")
        .delete()
        .eq("reservation_guest_id", reservationGuestId);

      // Delete the reservation_guest record
      const { error } = await supabase
        .from("reservation_guests")
        .delete()
        .eq("id", reservationGuestId);

      if (error) throw error;

      toast.success("Guest removed from reservation");
      await loadReservationGuests();
      return true;
    } catch (err) {
      console.error("Error removing guest:", err);
      toast.error("Failed to remove guest");
      return false;
    }
  };

  const updateGuestDetails = async (
    guestId: string, 
    updates: Partial<{
      first_name: string;
      last_name: string;
      email: string;
      phone: string | null;
      phone2: string | null;
      title: string | null;
      street_address: string | null;
      city: string | null;
      state: string | null;
      zipcode: string | null;
      country: string | null;
      birthday: string | null;
      anniversary: string | null;
      likes_dislikes: string | null;
    }>
  ): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("guests")
        .update(updates)
        .eq("id", guestId);

      if (error) throw error;

      await loadReservationGuests();
      return true;
    } catch (err) {
      console.error("Error updating guest:", err);
      toast.error("Failed to update guest details");
      return false;
    }
  };

  const getGuestFolioId = (reservationGuestId: string): string | null => {
    const rg = reservationGuests.find(g => g.id === reservationGuestId);
    return rg?.ledger_account?.id || null;
  };

  const canAddMoreGuests = reservationGuests.length < MAX_GUESTS;

  return {
    reservationGuests,
    loading,
    error,
    addGuest,
    removeGuest,
    updateGuestDetails,
    getGuestFolioId,
    canAddMoreGuests,
    maxGuests: MAX_GUESTS,
    reload: loadReservationGuests,
  };
};
