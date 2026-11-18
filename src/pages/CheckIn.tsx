import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { formatLocalDate } from "@/lib/dateUtils";
import { 
  Search, 
  CheckCircle,
  Calendar, 
  User, 
  MapPin, 
  DollarSign,
  ArrowRight,
  Edit,
  Users,
  CreditCard,
  AlertCircle,
  FileText
} from "lucide-react";
import { PaymentCardList } from "@/components/PaymentCardList";
import { PrintDocumentButton } from "@/components/PrintDocumentButton";
import { RegistrationCardDialog } from "@/components/RegistrationCardDialog";
import { useProperty } from "@/contexts/PropertyContext";
import { usePropertyTerminology } from "@/hooks/usePropertyTerminology";
import { useAuditDate } from "@/contexts/AuditDateContext";
import { logChange, getCurrentUserInfo } from "@/lib/changeJournal";

interface SiteType {
  id: string;
  name: string;
}

interface Reservation {
  id: string;
  confirmation_number: string;
  check_in_date: string;
  check_out_date: string;
  total_price: number;
  status: string;
  guests_count: number;
  adults_count: number;
  children_count: number;
  rate_id: string | null;
  site_id: string | null; // Can be null for type_floating hotels
  site_type_id: string | null; // Booked room type (for type_floating)
  guest_id: string;
  special_requests: string | null;
  sites: {
    site_number: string;
    site_types: {
      id: string;
      name: string;
    };
  } | null; // Can be null if no site assigned
  site_types?: {
    id: string;
    name: string;
  } | null; // Directly joined site type
  guests: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    street_address: string | null;
    city: string | null;
    state: string | null;
    zipcode: string | null;
  };
  rates?: {
    rate_code: string;
    revenue_account_id: string | null;
  };
}

interface AvailableRoom {
  id: string;
  site_number: string;
  site_type_id: string;
  site_types: {
    id: string;
    name: string;
  };
}

const CheckIn = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { selectedProperty } = useProperty();
  const terminology = usePropertyTerminology();
  const { auditDate } = useAuditDate();
  const [searchTerm, setSearchTerm] = useState("");
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showRegDialog, setShowRegDialog] = useState(false);
  const [createdFolioId, setCreatedFolioId] = useState<string | null>(null);
  
  // Editable fields
  const [adultsCount, setAdultsCount] = useState(1);
  const [childrenCount, setChildrenCount] = useState(0);
  const [checkInDate, setCheckInDate] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  
  // Room assignment for type_floating hotels
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [availableRooms, setAvailableRooms] = useState<AvailableRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  
  // Room type selection state
  const [allSiteTypes, setAllSiteTypes] = useState<SiteType[]>([]);
  const [selectedSiteTypeId, setSelectedSiteTypeId] = useState<string | null>(null);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  
  // Advance deposit info
  const [advanceDeposit, setAdvanceDeposit] = useState(0);

  // Load all site types for the property
  useEffect(() => {
    const loadSiteTypes = async () => {
      if (!selectedProperty?.id) return;
      const { data } = await supabase
        .from("site_types")
        .select("id, name")
        .eq("property_id", selectedProperty.id)
        .order("name");
      setAllSiteTypes(data || []);
    };
    loadSiteTypes();
  }, [selectedProperty?.id]);

  useEffect(() => {
    const reservationId = searchParams.get('reservationId') || searchParams.get('reservation');
    if (reservationId) {
      loadSingleReservation(reservationId);
    } else {
      loadArrivals();
    }
  }, [searchParams, selectedProperty?.id]);

  const loadArrivals = async () => {
    if (!selectedProperty?.id) return;
    
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];
    
    const { data, error } = await supabase
      .from("reservations")
      .select(`
        *,
        sites(site_number, site_types(id, name)),
        site_types(id, name),
        guests(id, first_name, last_name, email, phone, street_address, city, state, zipcode),
        rates(rate_code, revenue_account_id)
      `)
      .eq("property_id", selectedProperty.id)
      .in("status", ["CONFIRMED", "CHECK_IN_HOLD"])
      .lte("check_in_date", today)
      .order("check_in_date", { ascending: true });

    if (error) {
      toast.error("Failed to load arrivals");
    } else {
      setReservations(data || []);
    }
    setLoading(false);
  };

  const loadSingleReservation = async (id: string) => {
    setLoading(true);
    
    const { data, error } = await supabase
      .from("reservations")
      .select(`
        *,
        sites(site_number, site_types(id, name)),
        site_types(id, name),
        guests(id, first_name, last_name, email, phone, street_address, city, state, zipcode),
        rates(rate_code, revenue_account_id)
      `)
      .eq("id", id)
      .single();

    if (error) {
      toast.error("Failed to load reservation");
      navigate("/reservations");
    } else if (data) {
      setReservations([data]);
      handleSelectReservation(data);
    }
    setLoading(false);
  };

  const handleSelectReservation = async (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setAdultsCount(reservation.adults_count || reservation.guests_count || 1);
    setChildrenCount(reservation.children_count || 0);
    setCheckInDate(reservation.check_in_date);
    setCheckOutDate(reservation.check_out_date);
    setSpecialRequests(reservation.special_requests || "");
    
    // Determine the site type: from direct site_type_id, from assigned site, or null
    const siteTypeId = reservation.site_type_id || reservation.sites?.site_types?.id || null;
    setSelectedSiteTypeId(siteTypeId);
    
    // Reset room selection
    setSelectedRoomId(reservation.site_id || null);
    setAvailableRooms([]);
    
    // If no room assigned and we're a hotel, load available rooms for the site type
    if (!reservation.site_id && terminology.isHotel && siteTypeId) {
      await loadAvailableRooms(reservation.check_in_date, reservation.check_out_date, siteTypeId);
    }
    
    // Load advance deposit balance
    const { data: ledgerAccount } = await supabase
      .from("ledger_accounts")
      .select("balance")
      .eq("reservation_id", reservation.id)
      .eq("ledger_type", "advance_deposit")
      .eq("is_active", true)
      .maybeSingle();
    
    setAdvanceDeposit(ledgerAccount?.balance || 0);
  };

  // Load available rooms for the reservation dates, filtered by site type
  const loadAvailableRooms = async (checkIn: string, checkOut: string, siteTypeId?: string | null) => {
    if (!selectedProperty?.id) return;
    
    setLoadingRooms(true);
    try {
      // Get all active rooms, optionally filtered by site type
      let query = supabase
        .from("sites")
        .select("id, site_number, site_type_id, site_types(id, name)")
        .eq("property_id", selectedProperty.id)
        .eq("is_active", true);
      
      // Filter by site type if provided
      if (siteTypeId) {
        query = query.eq("site_type_id", siteTypeId);
      }
      
      const { data: allRooms, error: roomsError } = await query.order("site_number");

      if (roomsError) throw roomsError;

      // Get rooms that are already booked for the date range (excluding current reservation)
      let bookingsQuery = supabase
        .from("reservations")
        .select("site_id")
        .eq("property_id", selectedProperty.id)
        .not("site_id", "is", null)
        .in("status", ["CONFIRMED", "CHECKED_IN"])
        .lt("check_in_date", checkOut)
        .gt("check_out_date", checkIn);
      
      // Exclude current reservation when checking availability
      if (selectedReservation?.id) {
        bookingsQuery = bookingsQuery.neq("id", selectedReservation.id);
      }
      
      const { data: bookedReservations, error: bookingsError } = await bookingsQuery;

      if (bookingsError) throw bookingsError;

      const bookedRoomIds = new Set(bookedReservations?.map(r => r.site_id) || []);
      
      // Filter to available rooms
      const available = (allRooms || []).filter(room => !bookedRoomIds.has(room.id)) as AvailableRoom[];
      setAvailableRooms(available);
    } catch (error) {
      console.error("Failed to load available rooms:", error);
      toast.error("Failed to load available rooms");
    } finally {
      setLoadingRooms(false);
    }
  };
  
  // Handle room type change
  const handleSiteTypeChange = async (newSiteTypeId: string) => {
    if (!selectedReservation) return;
    
    setCheckingAvailability(true);
    setSelectedSiteTypeId(newSiteTypeId);
    setSelectedRoomId(null); // Reset room selection when type changes
    
    // Load available rooms for the new type
    await loadAvailableRooms(checkInDate, checkOutDate, newSiteTypeId);
    setCheckingAvailability(false);
  };

  const handleCheckIn = async () => {
    if (!selectedReservation) return;
    
    // Determine the final room/site ID (either pre-assigned or selected during check-in)
    const finalSiteId = selectedReservation.site_id || selectedRoomId;
    
    // Validate room is assigned
    if (!finalSiteId) {
      toast.error(`Please assign a ${terminology.site.toLowerCase()} before check-in`);
      return;
    }
    
    setProcessing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const staffName = user?.user_metadata?.first_name 
        ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`
        : 'Staff';
      
      // Get user info for change journal
      const { userId, userName } = await getCurrentUserInfo();
      
      // 1. Update reservation with confirmed data (including room assignment if needed)
      const updateData: any = {
        status: "CHECKED_IN",
        check_in_date: checkInDate,
        check_out_date: checkOutDate,
        adults_count: adultsCount,
        children_count: childrenCount,
        special_requests: specialRequests,
      };
      
      // If room was assigned during check-in, update it
      if (!selectedReservation.site_id && selectedRoomId) {
        updateData.site_id = selectedRoomId;
      }
      
      // If site type was changed during check-in, update it
      const originalSiteTypeId = selectedReservation.site_type_id || selectedReservation.sites?.site_types?.id;
      if (selectedSiteTypeId && selectedSiteTypeId !== originalSiteTypeId) {
        updateData.site_type_id = selectedSiteTypeId;
      }
      
      const { error: updateError } = await supabase
        .from("reservations")
        .update(updateData)
        .eq("id", selectedReservation.id);

      if (updateError) throw updateError;

      // Log the status change to change journal
      if (selectedProperty?.id) {
        await logChange({
          propertyId: selectedProperty.id,
          recordType: "reservation",
          recordId: selectedReservation.id,
          recordIdentifier: selectedReservation.confirmation_number,
          fieldName: "status",
          oldValue: "CONFIRMED",
          newValue: "CHECKED_IN",
          userId,
          userName,
        });
      }

      // Campground PMS: site occupancy is tracked via reservation status; no site-level occupancy update needed.

      // 2. Check for existing advance deposit ledger
      const { data: advanceLedger } = await supabase
        .from("ledger_accounts")
        .select("*")
        .eq("reservation_id", selectedReservation.id)
        .eq("ledger_type", "advance_deposit")
        .eq("is_active", true)
        .maybeSingle();

      // 3. Create guest ledger (folio) - check for existing first to prevent duplicates
      if (!selectedProperty?.id) {
        toast.error("No property selected");
        setProcessing(false);
        return;
      }

      // Check for existing active guest ledger
      const { data: existingGuestLedger } = await supabase
        .from("ledger_accounts")
        .select("id, balance")
        .eq("reservation_id", selectedReservation.id)
        .eq("ledger_type", "guest")
        .eq("is_active", true)
        .maybeSingle();

      let guestLedger = existingGuestLedger;

      // Only create if none exists
      if (!existingGuestLedger) {
        const { data: newGuestLedger, error: ledgerError } = await supabase
          .from("ledger_accounts")
          .insert({
            property_id: selectedProperty.id,
            ledger_type: "guest",
            reservation_id: selectedReservation.id,
            guest_id: selectedReservation.guest_id,
            balance: 0,
          })
          .select()
          .single();

        if (ledgerError) throw ledgerError;
        guestLedger = newGuestLedger;
      }

      if (!guestLedger) throw new Error("Failed to create or find guest ledger");

      // 4. If there's an advance deposit, transfer it to guest ledger
      if (advanceLedger && advanceLedger.balance > 0) {
        // Post transfer out from advance deposit
        await supabase.from("ledger_transactions").insert({
          ledger_account_id: advanceLedger.id,
          transaction_type: "transfer",
          description: "Transfer to Guest Folio on Check-In",
          credit_amount: advanceLedger.balance,
          debit_amount: 0,
          posted_by_name: staffName,
        });

        // Post transfer in to guest ledger as credit (reduces what guest owes)
        await supabase.from("ledger_transactions").insert({
          ledger_account_id: guestLedger.id,
          transaction_type: "transfer",
          description: "Advance Deposit Transfer",
          credit_amount: advanceLedger.balance,
          debit_amount: 0,
          posted_by_name: staffName,
        });

        // Create folio posting record with explicit debit/credit
        await supabase.from("folio_postings").insert({
          ledger_account_id: guestLedger.id,
          posting_type: "payment",
          description: "Advance Deposit Transfer",
          amount: -advanceLedger.balance, // Legacy field (negative = credit)
          debit_amount: 0,
          credit_amount: advanceLedger.balance,
          running_balance: -advanceLedger.balance,
          posting_date: auditDate,
          posted_by: user?.id,
          posted_by_name: staffName,
        });

        // Close advance deposit ledger
        await supabase
          .from("ledger_accounts")
          .update({ is_active: false, closed_at: new Date().toISOString() })
          .eq("id", advanceLedger.id);
      }

      // Note: Room charges are NOT posted at check-in. 
      // The night audit process posts room revenue nightly.
      // This ensures guests are only charged for nights they actually stay,
      // and no adjustments are needed for early departures.

      toast.success("Guest checked in successfully! Folio created.");
      setShowConfirmDialog(false);
      setCreatedFolioId(guestLedger.id);
      setShowSuccessDialog(true);
    } catch (error) {
      console.error("Check-in error:", error);
      toast.error("Failed to complete check-in");
    } finally {
      setProcessing(false);
    }
  };

  const nights = selectedReservation 
    ? differenceInDays(new Date(checkOutDate), new Date(checkInDate))
    : 0;

  const filteredReservations = reservations.filter((res) => {
    if (!res.guests) return false; // Filter out reservations with no guest
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    return (
      res.guests.first_name?.toLowerCase().includes(search) ||
      res.guests.last_name?.toLowerCase().includes(search) ||
      (res.sites?.site_number?.toLowerCase().includes(search) ?? false)
    );
  });

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Guest Check-In</h1>
          <p className="text-sm md:text-base text-muted-foreground">Process guest arrivals and create folios</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-4 md:gap-6">
          {/* Arrivals List */}
          <Card className="p-3 md:p-4">
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <h3 className="font-semibold text-sm md:text-base">Pending Arrivals</h3>
              <Badge variant="secondary">{reservations.length}</Badge>
            </div>

            <div className="relative mb-3 md:mb-4">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search by name or ${terminology.site.toLowerCase()}...`}
                className="pl-9 h-11 md:h-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="space-y-2 max-h-[300px] lg:max-h-[500px] overflow-y-auto">

              {loading ? (
                <p className="text-muted-foreground text-center py-4">Loading...</p>
              ) : filteredReservations.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No pending arrivals</p>
              ) : (
                filteredReservations.map((reservation) => (
                  <button
                    key={reservation.id}
                    onClick={() => handleSelectReservation(reservation)}
                    className={`w-full p-3 rounded-lg border text-left transition-colors ${
                      selectedReservation?.id === reservation.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">
                        {reservation.guests?.first_name} {reservation.guests?.last_name}
                      </div>
                      {reservation.sites ? (
                        <Badge variant="outline">{reservation.sites.site_number}</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-amber-600">No {terminology.site}</Badge>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {formatLocalDate(reservation.check_in_date, "MMM d")} - {formatLocalDate(reservation.check_out_date, "MMM d")}
                    </div>
                  </button>
                ))
              )}
            </div>
          </Card>

          {/* Reservation Details */}
          <Card className="p-4 md:p-6 lg:col-span-2">
            {selectedReservation ? (
              <div className="space-y-4 md:space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg md:text-xl font-semibold truncate">
                        {selectedReservation.guests?.first_name} {selectedReservation.guests?.last_name}
                      </h2>
                      <span className="text-xs md:text-sm font-mono bg-muted px-2 py-0.5 rounded">
                        #{selectedReservation.confirmation_number}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      {selectedReservation.guests?.email} • {selectedReservation.guests?.phone || 'No phone'}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => navigate(`/reservation/edit?id=${selectedReservation.id}`)}>
                    <Edit className="h-4 w-4 mr-1" />
                    Edit Full Details
                  </Button>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">

                  {/* Site/Room Info or Assignment */}
                  <div className="space-y-1">
                    <Label className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      {terminology.site}
                    </Label>
                    {selectedReservation.sites ? (
                      <div className="p-3 rounded-lg bg-muted">
                        <span className="font-medium">{selectedReservation.sites.site_number}</span>
                        {selectedReservation.sites.site_types && (
                          <span className="text-muted-foreground ml-2">({selectedReservation.sites.site_types.name})</span>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                            <AlertCircle className="h-4 w-4" />
                            <span className="text-sm font-medium">No {terminology.site.toLowerCase()} assigned</span>
                          </div>
                        </div>
                        
                        {/* Room Type Selector */}
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">{terminology.siteType}</Label>
                          <Select 
                            value={selectedSiteTypeId || ""} 
                            onValueChange={handleSiteTypeChange}
                            disabled={checkingAvailability}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={`Select ${terminology.siteType.toLowerCase()}...`} />
                            </SelectTrigger>
                            <SelectContent>
                              {allSiteTypes.map((type) => (
                                <SelectItem key={type.id} value={type.id}>
                                  {type.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {/* Room Selector - only show if site type is selected */}
                        {selectedSiteTypeId && (
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">{terminology.site}</Label>
                            <Select 
                              value={selectedRoomId || ""} 
                              onValueChange={(value) => setSelectedRoomId(value)}
                              disabled={loadingRooms || checkingAvailability}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={loadingRooms ? "Loading..." : `Select ${terminology.site.toLowerCase()}...`} />
                              </SelectTrigger>
                              <SelectContent>
                                {availableRooms.map((room) => (
                                  <SelectItem key={room.id} value={room.id}>
                                    {room.site_number}
                                  </SelectItem>
                                ))}
                                {availableRooms.length === 0 && !loadingRooms && (
                                  <div className="px-2 py-1 text-sm text-muted-foreground">
                                    No {terminology.sites.toLowerCase()} available for this type
                                  </div>
                                )}
                              </SelectContent>
                            </Select>
                            {availableRooms.length === 0 && !loadingRooms && selectedSiteTypeId && (
                              <p className="text-xs text-amber-600 dark:text-amber-400">
                                No {terminology.sites.toLowerCase()} available. Try selecting a different {terminology.siteType.toLowerCase()}.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Rate */}
                  <div className="space-y-1">
                    <Label className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Rate
                    </Label>
                    <div className="p-3 rounded-lg bg-muted">
                      <span className="font-medium">{selectedReservation.rates?.rate_code || 'Standard'}</span>
                      <span className="text-muted-foreground ml-2">${selectedReservation.total_price.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Check-in Date */}
                  <div className="space-y-1">
                    <Label className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Check-In Date
                    </Label>
                    <Input
                      type="date"
                      value={checkInDate}
                      onChange={(e) => setCheckInDate(e.target.value)}
                    />
                  </div>

                  {/* Check-out Date */}
                  <div className="space-y-1">
                    <Label className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Check-Out Date
                    </Label>
                    <Input
                      type="date"
                      value={checkOutDate}
                      onChange={(e) => setCheckOutDate(e.target.value)}
                    />
                  </div>

                  {/* Adults */}
                  <div className="space-y-1">
                    <Label className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Adults
                    </Label>
                    <Select value={adultsCount.toString()} onValueChange={(v) => setAdultsCount(parseInt(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                          <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Children */}
                  <div className="space-y-1">
                    <Label className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      Children
                    </Label>
                    <Select value={childrenCount.toString()} onValueChange={(v) => setChildrenCount(parseInt(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                          <SelectItem key={n} value={n.toString()}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Special Requests */}
                <div className="space-y-1">
                  <Label>Special Requests</Label>
                  <Input
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                    placeholder="Any special requests or notes..."
                  />
                </div>

                {/* Payment Cards */}
                <div className="border-t pt-4">
                  <PaymentCardList reservationId={selectedReservation.id} />
                </div>

                {/* Summary */}
                <Card className="p-4 bg-muted/50">
                  <h3 className="font-semibold mb-3">Check-In Summary</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Stay Duration</span>
                      <span>{nights} night{nights !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Site Charges</span>
                      <span>${selectedReservation.total_price.toFixed(2)}</span>
                    </div>
                    {advanceDeposit > 0 && (
                      <div className="flex justify-between text-green-600">
                        <span>Advance Deposit</span>
                        <span>-${advanceDeposit.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="border-t pt-2 flex justify-between font-semibold">
                      <span>Opening Balance</span>
                      <span>${(selectedReservation.total_price - advanceDeposit).toFixed(2)}</span>
                    </div>
                  </div>
                </Card>

                {selectedReservation.status === "CHECK_IN_HOLD" ? (
                  <>
                    <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 mb-3 text-sm flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5" />
                      <div>
                        <div className="font-medium">Checked in on hold (mobile check-in)</div>
                        <div className="text-muted-foreground text-xs mt-0.5">
                          Guest has folio and facility access. Release to site when it's ready.
                        </div>
                      </div>
                    </div>
                    <Button
                      className="w-full"
                      size="lg"
                      onClick={async () => {
                        if (!selectedReservation) return;
                        setProcessing(true);
                        const finalSiteId = selectedReservation.site_id || selectedRoomId;
                        const updates: any = {
                          status: "CHECKED_IN",
                          needs_staff_review: false,
                          checkin_hold_reason: null,
                        };
                        if (finalSiteId && !selectedReservation.site_id) updates.site_id = finalSiteId;
                        const { error } = await supabase
                          .from("reservations")
                          .update(updates)
                          .eq("id", selectedReservation.id);
                        setProcessing(false);
                        if (error) toast.error("Failed to release to site");
                        else {
                          toast.success("Guest released to site");
                          loadArrivals();
                          setSelectedReservation(null);
                        }
                      }}
                      disabled={processing || (!selectedReservation.site_id && !selectedRoomId)}
                    >
                      <CheckCircle className="h-5 w-5 mr-2" />
                      Release to site
                      <ArrowRight className="h-5 w-5 ml-2" />
                    </Button>
                    {!selectedReservation.site_id && !selectedRoomId && (
                      <p className="text-sm text-amber-600 text-center mt-2">
                        Assign a {terminology.site.toLowerCase()} to release
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <Button
                      className="w-full"
                      size="lg"
                      onClick={() => setShowConfirmDialog(true)}
                      disabled={!selectedReservation.site_id && !selectedRoomId}
                    >
                      <CheckCircle className="h-5 w-5 mr-2" />
                      Complete Check-In
                      <ArrowRight className="h-5 w-5 ml-2" />
                    </Button>
                    {!selectedReservation.site_id && !selectedRoomId && (
                      <p className="text-sm text-amber-600 text-center mt-2">
                        Please assign a {terminology.site.toLowerCase()} to continue
                      </p>
                    )}
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                Select an arrival to begin check-in
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Check-In</DialogTitle>
          </DialogHeader>
          
          {selectedReservation && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted">
                <p className="font-medium">
                  {selectedReservation.guests?.first_name} {selectedReservation.guests?.last_name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {terminology.site} {selectedReservation.sites?.site_number || availableRooms.find(r => r.id === selectedRoomId)?.site_number} • {nights} nights
                </p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(checkInDate), "MMM d, yyyy")} - {format(new Date(checkOutDate), "MMM d, yyyy")}
                </p>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Adults</span>
                  <span>{adultsCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Children</span>
                  <span>{childrenCount}</span>
                </div>
                <div className="flex justify-between font-semibold pt-2 border-t">
                  <span>Opening Folio Balance</span>
                  <span>${(selectedReservation.total_price - advanceDeposit).toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCheckIn} disabled={processing}>
              {processing ? "Processing..." : "Confirm Check-In"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog with Print Option */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Check-In Complete
            </DialogTitle>
          </DialogHeader>
          
          {selectedReservation && (
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-muted">
                <p className="font-medium">
                  {selectedReservation.guests?.first_name} {selectedReservation.guests?.last_name}
                </p>
                <p className="text-sm text-muted-foreground">
                  Successfully checked into {terminology.site} {selectedReservation.sites?.site_number || availableRooms.find(r => r.id === selectedRoomId)?.site_number}
                </p>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Print a registration card for the guest to sign, or capture their signature on-screen — great for tablets and touchscreens.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {selectedReservation && (
              <>
                <Button
                  variant="outline"
                  onClick={() => setShowRegDialog(true)}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Registration Card
                </Button>
              </>
            )}
            <Button 
              onClick={() => {
                setShowSuccessDialog(false);
                navigate(`${terminology.isHotel ? '/in-house-guests' : '/in-park-guests'}?folio=${createdFolioId}`);
              }}
            >
              Go to Folio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedReservation && (
        <RegistrationCardDialog
          open={showRegDialog}
          onOpenChange={setShowRegDialog}
          reservationId={selectedReservation.id}
          defaultMode="sign"
        />
      )}
    </DashboardLayout>
  );
};

export default CheckIn;