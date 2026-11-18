import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ShareReservation {
  id: string;
  confirmation_number: string;
  guest_id: string;
  check_in_date: string;
  check_out_date: string;
  status: string;
  is_share_master: boolean | null;
  share_group_id: string | null;
  master_reservation_id: string | null;
  site_id: string | null;
  rate_id: string | null;
  total_price: number;
  guest?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  } | null;
  site?: {
    id: string;
    site_number: string;
  } | null;
  ledger_account?: {
    id: string;
    balance: number;
  } | null;
}

export interface ShareGroup {
  shareGroupId: string;
  masterReservation: ShareReservation;
  shareReservations: ShareReservation[];
}

export interface AddSharerParams {
  masterReservationId: string;
  guestId: string;
  checkInDate: string;
  checkOutDate: string;
  rateId: string | null;
  totalPrice: number;
  rateSplitType: 'no_charge' | 'split_equal' | 'custom' | 'independent';
  propertyId: string;
  organizationId?: string;
  sourceOfBusinessId?: string;
}

export function useSharedReservations(reservationId?: string) {
  const [shareGroup, setShareGroup] = useState<ShareGroup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadShareGroup = useCallback(async () => {
    if (!reservationId) return;

    setLoading(true);
    setError(null);

    try {
      // First get the current reservation to find its share_group_id
      const { data: currentRes, error: currentError } = await supabase
        .from('reservations')
        .select(`
          id,
          confirmation_number,
          guest_id,
          check_in_date,
          check_out_date,
          status,
          is_share_master,
          share_group_id,
          master_reservation_id,
          site_id,
          rate_id,
          total_price,
          guest:guests(id, first_name, last_name, email),
          site:sites(id, site_number)
        `)
        .eq('id', reservationId)
        .single();

      if (currentError) throw currentError;

      // If no share_group_id, this reservation has no shares
      if (!currentRes.share_group_id) {
        setShareGroup(null);
        setLoading(false);
        return;
      }

      // Fetch all reservations in the share group
      const { data: shareResArr, error: shareError } = await supabase
        .from('reservations')
        .select(`
          id,
          confirmation_number,
          guest_id,
          check_in_date,
          check_out_date,
          status,
          is_share_master,
          share_group_id,
          master_reservation_id,
          site_id,
          rate_id,
          total_price,
          guest:guests(id, first_name, last_name, email),
          site:sites(id, site_number)
        `)
        .eq('share_group_id', currentRes.share_group_id)
        .order('confirmation_number', { ascending: true });

      if (shareError) throw shareError;

      // Also fetch ledger accounts for each reservation
      const reservationIds = shareResArr.map(r => r.id);
      const { data: ledgerAccounts } = await supabase
        .from('ledger_accounts')
        .select('id, balance, reservation_id')
        .in('reservation_id', reservationIds)
        .eq('ledger_type', 'guest');

      // Map ledger accounts to reservations
      const reservationsWithLedgers: ShareReservation[] = shareResArr.map(r => ({
        id: r.id,
        confirmation_number: r.confirmation_number,
        guest_id: r.guest_id,
        check_in_date: r.check_in_date,
        check_out_date: r.check_out_date,
        status: r.status,
        is_share_master: r.is_share_master,
        share_group_id: r.share_group_id,
        master_reservation_id: r.master_reservation_id,
        site_id: r.site_id,
        rate_id: r.rate_id,
        total_price: r.total_price,
        guest: r.guest,
        site: r.site,
        ledger_account: ledgerAccounts?.find(la => la.reservation_id === r.id) || null
      }));

      // Find the master (lowest confirmation number or is_share_master = true)
      const master = reservationsWithLedgers.find(r => r.is_share_master) || reservationsWithLedgers[0];
      const shares = reservationsWithLedgers.filter(r => r.id !== master.id);

      setShareGroup({
        shareGroupId: currentRes.share_group_id,
        masterReservation: master,
        shareReservations: shares
      });
    } catch (err: unknown) {
      console.error('Error loading share group:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [reservationId]);

  useEffect(() => {
    loadShareGroup();
  }, [loadShareGroup]);

  const getMasterReservation = useCallback(async (resId: string): Promise<ShareReservation | null> => {
    const { data, error } = await supabase
      .from('reservations')
      .select(`
        id,
        confirmation_number,
        guest_id,
        check_in_date,
        check_out_date,
        status,
        is_share_master,
        share_group_id,
        master_reservation_id,
        site_id,
        rate_id,
        total_price,
        guest:guests(id, first_name, last_name, email),
        site:sites(id, site_number)
      `)
      .eq('id', resId)
      .single();

    if (error || !data) return null;

    const result: ShareReservation = {
      id: data.id,
      confirmation_number: data.confirmation_number,
      guest_id: data.guest_id,
      check_in_date: data.check_in_date,
      check_out_date: data.check_out_date,
      status: data.status,
      is_share_master: data.is_share_master,
      share_group_id: data.share_group_id,
      master_reservation_id: data.master_reservation_id,
      site_id: data.site_id,
      rate_id: data.rate_id,
      total_price: data.total_price,
      guest: data.guest,
      site: data.site
    };

    // If this is the master, return it
    if (data.is_share_master) return result;

    // Otherwise, fetch the master
    if (data.master_reservation_id) {
      const { data: master } = await supabase
        .from('reservations')
        .select(`
          id,
          confirmation_number,
          guest_id,
          check_in_date,
          check_out_date,
          status,
          is_share_master,
          share_group_id,
          master_reservation_id,
          site_id,
          rate_id,
          total_price,
          guest:guests(id, first_name, last_name, email),
          site:sites(id, site_number)
        `)
        .eq('id', data.master_reservation_id)
        .single();

      if (master) {
        return {
          id: master.id,
          confirmation_number: master.confirmation_number,
          guest_id: master.guest_id,
          check_in_date: master.check_in_date,
          check_out_date: master.check_out_date,
          status: master.status,
          is_share_master: master.is_share_master,
          share_group_id: master.share_group_id,
          master_reservation_id: master.master_reservation_id,
          site_id: master.site_id,
          rate_id: master.rate_id,
          total_price: master.total_price,
          guest: master.guest,
          site: master.site
        };
      }
    }

    return null;
  }, []);

  const isShareMaster = useCallback((resId: string): boolean => {
    if (!shareGroup) return true;
    return shareGroup.masterReservation.id === resId;
  }, [shareGroup]);

  const canModifyDates = useCallback((newCheckIn: string, newCheckOut: string): { valid: boolean; message?: string } => {
    if (!shareGroup) return { valid: true };

    const masterCheckIn = new Date(shareGroup.masterReservation.check_in_date);
    const masterCheckOut = new Date(shareGroup.masterReservation.check_out_date);
    const newIn = new Date(newCheckIn);
    const newOut = new Date(newCheckOut);

    // For master, can expand dates but must ensure shares are still within range
    if (isShareMaster(reservationId || '')) {
      // Check if any shares would be outside new range
      for (const share of shareGroup.shareReservations) {
        const shareIn = new Date(share.check_in_date);
        const shareOut = new Date(share.check_out_date);
        
        if (shareIn < newIn || shareOut > newOut) {
          return {
            valid: false,
            message: `Cannot shorten dates: Share ${share.confirmation_number} has dates outside the new range`
          };
        }
      }
      return { valid: true };
    }

    // For shares, must stay within master's range
    if (newIn < masterCheckIn) {
      return {
        valid: false,
        message: `Check-in cannot be before master reservation (${shareGroup.masterReservation.check_in_date})`
      };
    }
    if (newOut > masterCheckOut) {
      return {
        valid: false,
        message: `Check-out cannot be after master reservation (${shareGroup.masterReservation.check_out_date})`
      };
    }

    return { valid: true };
  }, [shareGroup, isShareMaster, reservationId]);

  const addSharer = useCallback(async (params: AddSharerParams): Promise<{ success: boolean; reservationId?: string; error?: string }> => {
    try {
      // Fetch the master reservation details
      const { data: masterRes, error: masterError } = await supabase
        .from('reservations')
        .select('*, site:sites(id, site_number)')
        .eq('id', params.masterReservationId)
        .single();

      if (masterError || !masterRes) {
        throw new Error('Master reservation not found');
      }

      // Validate dates are within master's range
      const masterIn = new Date(masterRes.check_in_date);
      const masterOut = new Date(masterRes.check_out_date);
      const newIn = new Date(params.checkInDate);
      const newOut = new Date(params.checkOutDate);

      if (newIn < masterIn || newOut > masterOut) {
        throw new Error('Share dates must be within master reservation date range');
      }

      // Generate or use existing share_group_id
      const shareGroupId = masterRes.share_group_id || crypto.randomUUID();

      // If master doesn't have share_group_id yet, update it
      if (!masterRes.share_group_id) {
        await supabase
          .from('reservations')
          .update({ 
            share_group_id: shareGroupId,
            is_share_master: true 
          })
          .eq('id', params.masterReservationId);
      }

      // Calculate the share price based on split type
      let finalPrice = params.totalPrice;
      if (params.rateSplitType === 'no_charge') {
        finalPrice = 0;
      } else if (params.rateSplitType === 'split_equal') {
        // Get count of existing shares + 1 for the new one
        const { count } = await supabase
          .from('reservations')
          .select('id', { count: 'exact', head: true })
          .eq('share_group_id', shareGroupId);
        
        const totalSharers = (count || 1) + 1;
        finalPrice = masterRes.total_price / totalSharers;

        // Update master and existing shares with new split amount
        await supabase
          .from('reservations')
          .update({ total_price: finalPrice })
          .eq('share_group_id', shareGroupId);
      }

      // Create the new share reservation
      const { data: newRes, error: insertError } = await supabase
        .from('reservations')
        .insert({
          property_id: params.propertyId,
          guest_id: params.guestId,
          site_id: masterRes.site_id, // Inherit site from master
          rate_id: params.rateId,
          source_of_business_id: params.sourceOfBusinessId || masterRes.source_of_business_id,
          check_in_date: params.checkInDate,
          check_out_date: params.checkOutDate,
          adults_count: 1,
          children_count: 0,
          total_price: finalPrice,
          status: 'CONFIRMED',
          share_group_id: shareGroupId,
          is_share_master: false,
          master_reservation_id: params.masterReservationId
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Check for existing ledger account before creating
      const { data: existingLedger } = await supabase
        .from('ledger_accounts')
        .select('id')
        .eq('reservation_id', newRes.id)
        .eq('ledger_type', 'guest')
        .eq('is_active', true)
        .maybeSingle();

      // Only create ledger account if none exists
      if (!existingLedger) {
        await supabase
          .from('ledger_accounts')
          .insert({
            property_id: params.propertyId,
            reservation_id: newRes.id,
            guest_id: params.guestId,
            ledger_type: 'guest',
            balance: 0,
            is_active: true
          });
      }

      toast.success('Sharer added successfully');
      await loadShareGroup();

      return { success: true, reservationId: newRes.id };
    } catch (err: unknown) {
      console.error('Error adding sharer:', err);
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast.error('Failed to add sharer: ' + message);
      return { success: false, error: message };
    }
  }, [loadShareGroup]);

  const removeSharer = useCallback(async (shareReservationId: string): Promise<boolean> => {
    try {
      // Check if this is the master
      const { data: shareRes } = await supabase
        .from('reservations')
        .select('is_share_master, share_group_id, status')
        .eq('id', shareReservationId)
        .single();

      if (!shareRes) {
        toast.error('Reservation not found');
        return false;
      }

      if (shareRes.is_share_master) {
        toast.error('Cannot remove master reservation. Transfer master status first or cancel all shares.');
        return false;
      }

      if (shareRes.status === 'CHECKED_IN') {
        toast.error('Cannot remove checked-in share. Check out first.');
        return false;
      }

      // Check ledger balance
      const { data: ledger } = await supabase
        .from('ledger_accounts')
        .select('balance')
        .eq('reservation_id', shareReservationId)
        .eq('ledger_type', 'guest')
        .single();

      if (ledger && ledger.balance !== 0) {
        toast.error('Cannot remove share with outstanding balance. Transfer charges first.');
        return false;
      }

      // Remove share_group_id and master_reservation_id (unlink from share group)
      // Or cancel the reservation
      await supabase
        .from('reservations')
        .update({
          share_group_id: null,
          master_reservation_id: null,
          is_share_master: true, // Reset to default
          status: 'CANCELLED'
        })
        .eq('id', shareReservationId);

      toast.success('Sharer removed from share group');
      await loadShareGroup();

      return true;
    } catch (err: unknown) {
      console.error('Error removing sharer:', err);
      toast.error('Failed to remove sharer');
      return false;
    }
  }, [loadShareGroup]);

  const hasShares = shareGroup !== null && shareGroup.shareReservations.length > 0;
  const isPartOfShareGroup = shareGroup !== null;
  const totalSharers = shareGroup ? shareGroup.shareReservations.length + 1 : 1;

  return {
    shareGroup,
    loading,
    error,
    loadShareGroup,
    getMasterReservation,
    isShareMaster,
    canModifyDates,
    addSharer,
    removeSharer,
    hasShares,
    isPartOfShareGroup,
    totalSharers
  };
}
