import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO, differenceInDays, addDays, eachDayOfInterval } from "date-fns";
import { formatLocalDate } from "@/lib/dateUtils";
import { ArrowLeft, Save, Calendar, MapPin, User, CheckCircle, RotateCcw, Building, XCircle, Users, Lock, LockOpen, Send, LogOut } from "lucide-react";
import { RegistrationCardDialog } from "@/components/RegistrationCardDialog";
import { PaymentCardList } from "@/components/PaymentCardList";
import { FolioDetail, FolioDetailRef } from "@/components/FolioDetail";
import { DepositManagementCard } from "@/components/DepositManagementCard";
import { useAuditDate } from "@/contexts/AuditDateContext";
import { usePropertyTerminology } from "@/hooks/usePropertyTerminology";
import { ShareGroupCard } from "@/components/ShareGroupCard";
import { useSharedReservations } from "@/hooks/useSharedReservations";
import { cn } from "@/lib/utils";
import { logMultipleChanges, getCurrentUserInfo, ChangeLogParams } from "@/lib/changeJournal";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Reservation {
  id: string;
  confirmation_number: string;
  check_in_date: string;
  check_out_date: string;
  status: string;
  total_price: number;
  adults_count: number;
  children_count: number;
  special_requests: string | null;
  site_id: string | null;
  site_type_id: string | null;
  guest_id: string;
  rate_id: string | null;
  property_id: string;
  city_ledger_account_id: string | null;
  billing_instructions: string | null;
  sites: {
    id: string;
    site_number: string;
    site_type_id: string;
    site_types: { name: string; base_price: number };
  } | null;
  guests: {
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
  };
  rates: {
    id: string;
    rate_code: string;
    revenue_account_id: string | null;
  } | null;
  city_ledger?: {
    company_name: string | null;
  } | null;
}

interface Rate {
  id: string;
  rate_code: string;
  description: string | null;
  is_base_rate?: boolean;
  base_rate_id?: string | null;
  adjustment_type?: string | null;
  adjustment_value?: number | null;
}

interface CityLedger {
  id: string;
  company_name: string | null;
  account_number: string | null;
}

interface Site {
  id: string;
  site_number: string;
  site_type_id: string;
  site_types: { name: string; code?: string };
}

interface SiteType {
  id: string;
  name: string;
  code?: string;
  base_price: number;
}

interface GroupBlockAllocation {
  site_id: string;
  allocation_date: string;
}

interface GroupBlockReservation {
  id: string;
  site_id: string;
  check_in_date: string;
  check_out_date: string;
}

const ReservationEdit = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reservationId = searchParams.get("id");
  const fromPage = searchParams.get("from"); // Track where user came from
  const fromGroupBlockId = searchParams.get("groupBlockId"); // For group block navigation
  const focusParam = searchParams.get("focus"); // e.g. "folio" to auto-scroll/expand
  const quickPost = searchParams.get("quickPost") === "1"; // auto-open posting dialog
  const folioRef = useRef<FolioDetailRef | null>(null);
  const folioSectionRef = useRef<HTMLDivElement | null>(null);
  const [folioActionDone, setFolioActionDone] = useState(false);

  // Helper to determine back navigation URL
  const getBackUrl = () => {
    if (fromPage === "in-park" && reservationId) {
      return `/in-park-guests?reservationId=${reservationId}`;
    }
    if (fromPage === "group-block" && fromGroupBlockId) {
      return `/group-blocks/${fromGroupBlockId}?tab=reservations`;
    }
    return "/reservations";
  };

  const [reservation, setReservation] = useState<Reservation | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [siteTypes, setSiteTypes] = useState<SiteType[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Reinstate dialog state
  const [showReinstateDialog, setShowReinstateDialog] = useState(false);
  const [reinstateCheckIn, setReinstateCheckIn] = useState("");
  const [reinstateCheckOut, setReinstateCheckOut] = useState("");
  const [reinstating, setReinstating] = useState(false);

  // Site move confirmation dialog state
  const [showMoveConfirmDialog, setShowMoveConfirmDialog] = useState(false);
  const [pendingSiteId, setPendingSiteId] = useState<string | null>(null);
  const [pendingSiteTypeId, setPendingSiteTypeId] = useState<string | null>(null);

  // Rate change confirmation dialog state
  const [showRateChangeDialog, setShowRateChangeDialog] = useState(false);
  const [currentBasePrice, setCurrentBasePrice] = useState<number | null>(null);
  const [newBasePrice, setNewBasePrice] = useState<number | null>(null);

  const { auditDate } = useAuditDate();
  const terminology = usePropertyTerminology();

  // Form state
  const [checkInDate, setCheckInDate] = useState("");
  const [checkOutDate, setCheckOutDate] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedSiteTypeId, setSelectedSiteTypeId] = useState("");
  const [adultsCount, setAdultsCount] = useState(1);
  const [childrenCount, setChildrenCount] = useState(0);
  const [specialRequests, setSpecialRequests] = useState("");

  // Guest form state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [phone2, setPhone2] = useState("");
  const [title, setTitle] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipcode, setZipcode] = useState("");

  // City ledger state
  const [cityLedgers, setCityLedgers] = useState<CityLedger[]>([]);
  const [selectedCityLedgerId, setSelectedCityLedgerId] = useState("none");
  const [billingInstructions, setBillingInstructions] = useState("");

  // Rate state
  const [rates, setRates] = useState<Rate[]>([]);
  const [selectedRateId, setSelectedRateId] = useState<string | null>(null);
  const [displayDailyRate, setDisplayDailyRate] = useState<number | null>(null);

  // Group block state
  const [groupBlockId, setGroupBlockId] = useState<string | null>(null);
  const [groupBlockCode, setGroupBlockCode] = useState<string | null>(null);
  const [groupBlockAllocations, setGroupBlockAllocations] = useState<GroupBlockAllocation[]>([]);
  const [groupBlockReservations, setGroupBlockReservations] = useState<GroupBlockReservation[]>([]);

  // Cancel dialog state
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showRegDialog, setShowRegDialog] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  // Check-out dialog state
  const [showCheckOutDialog, setShowCheckOutDialog] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkOutBalance, setCheckOutBalance] = useState<number>(0);

  // Assignment lock state
  const [assignmentLocked, setAssignmentLocked] = useState(false);
  const [originalAssignmentLocked, setOriginalAssignmentLocked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Share group state
  const { shareGroup, loading: shareGroupLoading, loadShareGroup, addSharer, removeSharer } = useSharedReservations(reservationId || undefined);

  // Check if current user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();
        
        setIsAdmin(data?.role === "admin" || data?.role === "super_admin");
      }
    };
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (reservationId) {
      loadReservation();
    }
  }, [reservationId]);

  useEffect(() => {
    if (reservation?.property_id) {
      loadSites();
      loadCityLedgers();
      loadSiteTypes();
      loadRates();
    }
  }, [reservation?.property_id]);

  // Auto-scroll to folio and optionally open the posting dialog when navigated
  // here from the dashboard with focus=folio or quickPost=1.
  useEffect(() => {
    if (!reservation || folioActionDone) return;
    if (!focusParam && !quickPost) return;
    const t = setTimeout(() => {
      folioSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      folioRef.current?.expand();
      if (quickPost) {
        folioRef.current?.openPostingDialog("charge");
      }
      setFolioActionDone(true);
    }, 250);
    return () => clearTimeout(t);
  }, [reservation, focusParam, quickPost, folioActionDone]);

  // Load group block allocations and reservations when group block is detected
  useEffect(() => {
    const loadGroupBlockData = async () => {
      if (!groupBlockId || !reservationId) return;

      // Load room-specific allocations for this group block
      const { data: allocations } = await supabase
        .from("group_block_room_allocations")
        .select("site_id, allocation_date")
        .eq("group_block_id", groupBlockId)
        .not("site_id", "is", null);

      setGroupBlockAllocations(
        (allocations || [])
          .filter((a): a is { site_id: string; allocation_date: string } => a.site_id !== null)
      );

      // Load other reservations in this group block (excluding current reservation)
      const { data: otherReservations } = await supabase
        .from("reservations")
        .select("id, site_id, check_in_date, check_out_date")
        .eq("group_block_id", groupBlockId)
        .neq("id", reservationId)
        .not("site_id", "is", null)
        .in("status", ["PENDING", "CONFIRMED", "CHECKED_IN"]);

      setGroupBlockReservations(
        (otherReservations || [])
          .filter((r): r is GroupBlockReservation => r.site_id !== null)
      );
    };

    loadGroupBlockData();
  }, [groupBlockId, reservationId]);

  // Initialize the display rate when rates are loaded
  useEffect(() => {
    const initDisplayRate = async () => {
      if (rates.length > 0 && selectedRateId && selectedSiteTypeId) {
        const dailyPrice = await fetchRateDailyPrice(selectedRateId, selectedSiteTypeId);
        setDisplayDailyRate(dailyPrice);
      }
    };
    initDisplayRate();
  }, [rates, selectedRateId, selectedSiteTypeId]);

  const loadRates = async () => {
    if (!reservation?.property_id) return;
    
    const { data } = await supabase
      .from("rates")
      .select("id, rate_code, description, is_base_rate, base_rate_id, adjustment_type, adjustment_value")
      .eq("property_id", reservation.property_id)
      .order("rate_code");

    setRates(data || []);
  };

  // Helper function to apply derived rate adjustments
  const applyAdjustment = (basePrice: number, adjustmentType: string, adjustmentValue: number): number => {
    switch (adjustmentType) {
      case "percent_up":
        return basePrice * (1 + adjustmentValue / 100);
      case "percent_down":
        return basePrice * (1 - adjustmentValue / 100);
      case "amount_up":
        return basePrice + adjustmentValue;
      case "amount_down":
        return basePrice - adjustmentValue;
      default:
        return basePrice;
    }
  };

  // Fetch and calculate the daily rate for a given rate ID
  const fetchRateDailyPrice = async (rateId: string | null, siteTypeId: string): Promise<number | null> => {
    if (!rateId || !siteTypeId) return null;

    const rate = rates.find(r => r.id === rateId);
    if (!rate) return null;

    // First try to get rate-specific price for site type
    const { data: ratePrice } = await supabase
      .from("rate_site_type_prices")
      .select("price")
      .eq("rate_id", rateId)
      .eq("site_type_id", siteTypeId)
      .single();

    if (ratePrice) {
      // If derived rate, apply adjustment
      if (!rate.is_base_rate && rate.base_rate_id && rate.adjustment_type && rate.adjustment_value !== null) {
        const { data: baseRatePrice } = await supabase
          .from("rate_site_type_prices")
          .select("price")
          .eq("rate_id", rate.base_rate_id)
          .eq("site_type_id", siteTypeId)
          .single();
        
        if (baseRatePrice) {
          return applyAdjustment(baseRatePrice.price, rate.adjustment_type, rate.adjustment_value);
        }
      }
      return ratePrice.price;
    }

    // Fallback to site type base price
    const siteType = siteTypes.find(st => st.id === siteTypeId);
    return siteType?.base_price || null;
  };

  // Handle rate code change - immediately update displayed price
  const handleRateChange = async (rateId: string | null) => {
    setSelectedRateId(rateId);
    
    if (rateId && selectedSiteTypeId) {
      const dailyPrice = await fetchRateDailyPrice(rateId, selectedSiteTypeId);
      setDisplayDailyRate(dailyPrice);
    } else {
      setDisplayDailyRate(null);
    }
  };

  const loadCityLedgers = async () => {
    if (!reservation?.property_id) return;
    
    const { data } = await supabase
      .from("ledger_accounts")
      .select("id, company_name, account_number")
      .eq("property_id", reservation.property_id)
      .eq("ledger_type", "city")
      .eq("is_active", true)
      .order("company_name");

    setCityLedgers(data || []);
  };

  const loadReservation = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("reservations")
      .select(`
        *,
        sites (
          id,
          site_number,
          site_type_id,
          site_types (name, code, base_price)
        ),
        guests (*),
        rates (id, rate_code, revenue_account_id),
        city_ledger:city_ledger_account_id (company_name),
        group_blocks:group_block_id (code)
      `)
      .eq("id", reservationId)
      .single();

    if (error) {
      toast.error("Failed to load reservation");
      navigate("/reservations");
      return;
    }

    setReservation(data);
    
    // Populate form fields
    setCheckInDate(data.check_in_date);
    setCheckOutDate(data.check_out_date);
    setSelectedSiteId(data.site_id ?? "");
    setSelectedSiteTypeId(data.site_type_id || data.sites?.site_type_id || "");
    setAdultsCount(data.adults_count || 1);
    setChildrenCount(data.children_count || 0);
    setSpecialRequests(data.special_requests || "");

    // Guest fields
    setFirstName(data.guests.first_name);
    setLastName(data.guests.last_name);
    setEmail(data.guests.email);
    setPhone(data.guests.phone || "");
    setPhone2(data.guests.phone2 || "");
    setTitle(data.guests.title || "");
    setStreetAddress(data.guests.street_address || "");
    setCity(data.guests.city || "");
    setState(data.guests.state || "");
    setZipcode(data.guests.zipcode || "");

    // City ledger fields
    setSelectedCityLedgerId(data.city_ledger_account_id || "none");
    setBillingInstructions(data.billing_instructions || "");

    // Rate field
    setSelectedRateId(data.rate_id || null);

    // Group block field
    setGroupBlockId(data.group_block_id || null);
    setGroupBlockCode((data as any).group_blocks?.code || null);

    // Assignment lock field
    setAssignmentLocked(data.assignment_locked || false);
    setOriginalAssignmentLocked(data.assignment_locked || false);

    setLoading(false);
  };

  const loadSites = async () => {
    if (!reservation?.property_id) return;
    
    const { data } = await supabase
      .from("sites")
      .select(`
        id,
        site_number,
        site_type_id,
        site_types (name, code)
      `)
      .eq("property_id", reservation.property_id)
      .eq("is_active", true)
      .order("site_number");

    if (data) {
      setSites(data);
    }
  };

  const loadSiteTypes = async () => {
    if (!reservation?.property_id) return;
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await (supabase as any)
      .from("site_types")
      .select("id, name, code, base_price")
      .eq("property_id", reservation.property_id)
      .order("name");

    if (result.data) {
      setSiteTypes(result.data as SiteType[]);
    }
  };

  // Determine if this reservation is a non-master sharer (controlled by master)
  const isNonMasterSharer = shareGroup && 
    shareGroup.masterReservation?.id !== reservationId &&
    shareGroup.shareReservations.some(sr => sr.id === reservationId);
  
  const masterSiteId = shareGroup?.masterReservation?.site_id;

  // Handler for site selection change - with confirmation for checked-in guests
  const handleSiteChange = (newSiteId: string) => {
    // Prevent sharers from changing rooms
    if (isNonMasterSharer) {
      toast.error(`${terminology.site} assignment is controlled by the master reservation`);
      return;
    }
    
    // Handle "unassigned" selection - convert to empty string
    const effectiveSiteId = newSiteId === "unassigned" ? "" : newSiteId;
    
    // If not checked in, just set the site directly
    if (reservation?.status !== 'CHECKED_IN') {
      setSelectedSiteId(effectiveSiteId);
      return;
    }
    
    // For checked-in guests, show confirmation dialog
    setPendingSiteId(effectiveSiteId);
    setShowMoveConfirmDialog(true);
  };

  // Handler for site type selection change - with confirmation and rate check for checked-in guests
  const handleSiteTypeChange = (newSiteTypeId: string) => {
    // Prevent sharers from changing room type
    if (isNonMasterSharer) {
      toast.error(`${terminology.siteType} is controlled by the master reservation`);
      return;
    }
    
    // If not checked in, just set the type and clear site if needed
    if (reservation?.status !== 'CHECKED_IN') {
      setSelectedSiteTypeId(newSiteTypeId);
      const currentSite = sites.find(s => s.id === selectedSiteId);
      if (currentSite && currentSite.site_type_id !== newSiteTypeId) {
        setSelectedSiteId("");
      }
      return;
    }
    
    // For checked-in guests, check if rate will change
    const currentType = siteTypes.find(t => t.id === selectedSiteTypeId);
    const newType = siteTypes.find(t => t.id === newSiteTypeId);
    
    setPendingSiteTypeId(newSiteTypeId);
    
    if (currentType && newType && currentType.base_price !== newType.base_price) {
      // Rate will change - show rate change confirmation
      setCurrentBasePrice(currentType.base_price);
      setNewBasePrice(newType.base_price);
      setShowRateChangeDialog(true);
    } else {
      // No rate change, just confirm the type change
      setShowMoveConfirmDialog(true);
    }
  };

  // Confirm move handlers
  const handleConfirmMove = () => {
    if (pendingSiteId) {
      setSelectedSiteId(pendingSiteId);
      setPendingSiteId(null);
    }
    if (pendingSiteTypeId) {
      setSelectedSiteTypeId(pendingSiteTypeId);
      // Clear site when type changes
      const currentSite = sites.find(s => s.id === selectedSiteId);
      if (currentSite && currentSite.site_type_id !== pendingSiteTypeId) {
        setSelectedSiteId("");
      }
      setPendingSiteTypeId(null);
    }
    setShowMoveConfirmDialog(false);
  };

  const handleCancelMove = () => {
    setPendingSiteId(null);
    setPendingSiteTypeId(null);
    setShowMoveConfirmDialog(false);
  };

  // Rate change handlers
  const handleConfirmRateChange = () => {
    if (pendingSiteTypeId) {
      setSelectedSiteTypeId(pendingSiteTypeId);
      // Clear site when type changes
      const currentSite = sites.find(s => s.id === selectedSiteId);
      if (currentSite && currentSite.site_type_id !== pendingSiteTypeId) {
        setSelectedSiteId("");
      }
      setPendingSiteTypeId(null);
    }
    setShowRateChangeDialog(false);
    setCurrentBasePrice(null);
    setNewBasePrice(null);
  };

  const handleCancelRateChange = () => {
    setPendingSiteTypeId(null);
    setShowRateChangeDialog(false);
    setCurrentBasePrice(null);
    setNewBasePrice(null);
  };

  // Filter sites by selected site type and group block restrictions
  const filteredSites = (() => {
    let filtered = selectedSiteTypeId 
      ? sites.filter(site => site.site_type_id === selectedSiteTypeId)
      : sites;

    // If this is a group block with room-specific allocations, restrict room selection
    if (groupBlockId && groupBlockAllocations.length > 0 && checkInDate && checkOutDate) {
      // Get all nights of the stay
      const stayNights = eachDayOfInterval({
        start: parseISO(checkInDate),
        end: addDays(parseISO(checkOutDate), -1)
      });

      // Find rooms that are blocked for ALL nights of the reservation
      const roomsBlockedForAllNights = filtered.filter(site => {
        return stayNights.every(night => {
          const nightStr = format(night, "yyyy-MM-dd");
          return groupBlockAllocations.some(
            alloc => alloc.site_id === site.id && alloc.allocation_date === nightStr
          );
        });
      });

      // Exclude rooms that have OTHER reservations overlapping this stay
      const availableGroupRooms = roomsBlockedForAllNights.filter(site => {
        // Always allow current room so it shows in dropdown
        if (site.id === selectedSiteId) return true;
        
        // Check if another reservation overlaps
        return !groupBlockReservations.some(res => {
          if (res.site_id !== site.id) return false;
          const resCheckIn = parseISO(res.check_in_date);
          const resCheckOut = parseISO(res.check_out_date);
          const myCheckIn = parseISO(checkInDate);
          const myCheckOut = parseISO(checkOutDate);
          // Overlap if: myCheckIn < resCheckOut AND myCheckOut > resCheckIn
          return myCheckIn < resCheckOut && myCheckOut > resCheckIn;
        });
      });

      filtered = availableGroupRooms;
    }

    return filtered;
  })();

  const handleSave = async () => {
    if (!reservation) return;

    setSaving(true);

    try {
      // Get current user info for change logging
      const { userId, userName } = await getCurrentUserInfo();
      
      // Prepare change log entries
      const changes: ChangeLogParams[] = [];
      const baseParams = {
        propertyId: reservation.property_id,
        recordType: "reservation" as const,
        recordId: reservation.id,
        recordIdentifier: reservation.confirmation_number,
        userId,
        userName,
      };

      // Track reservation field changes
      if (checkInDate !== reservation.check_in_date) {
        changes.push({ ...baseParams, fieldName: "check_in_date", oldValue: reservation.check_in_date, newValue: checkInDate });
      }
      if (checkOutDate !== reservation.check_out_date) {
        changes.push({ ...baseParams, fieldName: "check_out_date", oldValue: reservation.check_out_date, newValue: checkOutDate });
      }
      if ((selectedSiteId || null) !== reservation.site_id) {
        const oldSite = sites.find(s => s.id === reservation.site_id);
        const newSite = sites.find(s => s.id === selectedSiteId);
        changes.push({ ...baseParams, fieldName: "site_id", oldValue: oldSite?.site_number || null, newValue: newSite?.site_number || null });
      }
      if ((selectedSiteTypeId || null) !== (reservation.site_type_id || reservation.sites?.site_type_id)) {
        const oldType = siteTypes.find(st => st.id === (reservation.site_type_id || reservation.sites?.site_type_id));
        const newType = siteTypes.find(st => st.id === selectedSiteTypeId);
        changes.push({ ...baseParams, fieldName: "site_type_id", oldValue: oldType?.name || null, newValue: newType?.name || null });
      }
      if (selectedRateId !== reservation.rate_id) {
        const oldRate = rates.find(r => r.id === reservation.rate_id);
        const newRate = rates.find(r => r.id === selectedRateId);
        changes.push({ ...baseParams, fieldName: "rate_id", oldValue: oldRate?.rate_code || null, newValue: newRate?.rate_code || null });
      }
      if (adultsCount !== (reservation.adults_count || 1)) {
        changes.push({ ...baseParams, fieldName: "adults_count", oldValue: reservation.adults_count, newValue: adultsCount });
      }
      if (childrenCount !== (reservation.children_count || 0)) {
        changes.push({ ...baseParams, fieldName: "children_count", oldValue: reservation.children_count, newValue: childrenCount });
      }
      const newCityLedgerId = selectedCityLedgerId === "none" ? null : selectedCityLedgerId;
      if (newCityLedgerId !== reservation.city_ledger_account_id) {
        const oldLedger = cityLedgers.find(cl => cl.id === reservation.city_ledger_account_id);
        const newLedger = cityLedgers.find(cl => cl.id === newCityLedgerId);
        changes.push({ ...baseParams, fieldName: "city_ledger_account_id", oldValue: oldLedger?.company_name || null, newValue: newLedger?.company_name || null });
      }

      // Update guest information
      const { error: guestError } = await supabase
        .from("guests")
        .update({
          first_name: firstName,
          last_name: lastName,
          email: email,
          phone: phone || null,
          phone2: phone2 || null,
          title: title || null,
          street_address: streetAddress || null,
          city: city || null,
          state: state || null,
          zipcode: zipcode || null,
        })
        .eq("id", reservation.guest_id);

      if (guestError) {
        console.error("Guest update error:", guestError);
        toast.error("Failed to update guest information");
        setSaving(false);
        return;
      }

      // Update reservation
      const { error: reservationError } = await supabase
        .from("reservations")
        .update({
          check_in_date: checkInDate,
          check_out_date: checkOutDate,
          site_id: selectedSiteId || null,
          site_type_id: selectedSiteTypeId || null,
          adults_count: adultsCount,
          children_count: childrenCount,
          special_requests: specialRequests || null,
          city_ledger_account_id: newCityLedgerId,
          billing_instructions: billingInstructions || null,
          rate_id: selectedRateId,
          assignment_locked: assignmentLocked,
        })
        .eq("id", reservation.id);

      if (reservationError) {
        console.error("Reservation update error:", reservationError);
        toast.error("Failed to update reservation");
        setSaving(false);
        return;
      }

      // Log changes to change journal
      if (changes.length > 0) {
        await logMultipleChanges(changes);
      }

      // If this is the master reservation and site changed, update all sharers too
      if (shareGroup?.masterReservation?.id === reservationId && 
          shareGroup.shareReservations.length > 0 &&
          selectedSiteId !== reservation.site_id) {
        const sharerIds = shareGroup.shareReservations.map(sr => sr.id);
        const { error: sharerUpdateError } = await supabase
          .from("reservations")
          .update({ 
            site_id: selectedSiteId || null,
            site_type_id: selectedSiteTypeId || null 
          })
          .in("id", sharerIds);
        
        if (sharerUpdateError) {
          console.error("Sharer update error:", sharerUpdateError);
          // Don't fail the whole save, just warn
          toast.warning("Master saved but failed to update sharer rooms");
        }
      }

      toast.success("Reservation updated successfully");
      navigate(getBackUrl());
    } catch (error) {
      console.error("Save error:", error);
      toast.error("Failed to save changes");
    }

    setSaving(false);
  };

  const isArrivingToday = () => {
    if (!reservation) return false;
    const today = format(new Date(), "yyyy-MM-dd");
    return reservation.check_in_date === today && reservation.status === "CONFIRMED";
  };

  const handleProceedToCheckIn = () => {
    if (reservation) {
      navigate(`/check-in?reservation=${reservation.id}`);
    }
  };

  const handleReinstateClick = () => {
    if (!reservation || !auditDate) return;
    
    const originalNights = differenceInDays(parseISO(reservation.check_out_date), parseISO(reservation.check_in_date));
    
    // If check-in is before audit date, set dates to audit date
    if (reservation.check_in_date < auditDate) {
      setReinstateCheckIn(auditDate);
      setReinstateCheckOut(format(addDays(parseISO(auditDate), originalNights), "yyyy-MM-dd"));
    } else {
      setReinstateCheckIn(reservation.check_in_date);
      setReinstateCheckOut(reservation.check_out_date);
    }
    
    setShowReinstateDialog(true);
  };

  const handleReinstate = async () => {
    if (!reservation) return;
    
    setReinstating(true);
    
    try {
      // Determine the target status based on current status
      // CHECKED_OUT -> CHECKED_IN (puts them back in the room)
      // CANCELLED/NO_SHOW -> CONFIRMED (ready for check-in)
      const targetStatus = reservation.status === "CHECKED_OUT" ? "CHECKED_IN" : "CONFIRMED";
      
      const { error } = await supabase
        .from("reservations")
        .update({
          status: targetStatus,
          check_in_date: reinstateCheckIn,
          check_out_date: reinstateCheckOut,
        })
        .eq("id", reservation.id);
      
      if (error) {
        console.error("Reinstate error:", error);
        toast.error("Failed to reinstate reservation");
        setReinstating(false);
        return;
      }
      
      // If reinstating from CHECKED_OUT, update the site status back to occupied
      if (reservation.status === "CHECKED_OUT" && reservation.site_id) {
        const { error: siteError } = await supabase
          .from("sites")
          .update({ 
            maintenance_status: "in_service"
          })
          .eq("id", reservation.site_id);
        
        if (siteError) {
          console.error("Error updating site status:", siteError);
          toast.warning("Reservation reinstated but room status may need manual update");
        }
      }
      
      const successMessage = reservation.status === "CHECKED_OUT" 
        ? "Guest reinstated back to checked-in status"
        : "Reservation reinstated successfully";
      toast.success(successMessage);
      setShowReinstateDialog(false);
      loadReservation(); // Refresh data
    } catch (error) {
      console.error("Reinstate error:", error);
      toast.error("Failed to reinstate reservation");
    }
    
    setReinstating(false);
  };

  const canReinstate = reservation?.status === "CANCELLED" || reservation?.status === "NO_SHOW" || reservation?.status === "CHECKED_OUT";
  const canCancel = reservation?.status === "PENDING" || reservation?.status === "CONFIRMED";
  const canCheckOut = reservation?.status === "CHECKED_IN";
  const needsDateAdjustment = reservation && auditDate && reservation.check_in_date < auditDate;

  const performCheckOut = async (knownLedgerId?: string) => {
    if (!reservation) return;
    setCheckingOut(true);
    try {
      // Always re-fetch the folio balance to be safe
      const { data: ledger } = await supabase
        .from("ledger_accounts")
        .select("id, balance")
        .eq("reservation_id", reservation.id)
        .eq("ledger_type", "guest")
        .eq("is_active", true)
        .maybeSingle();

      const bal = Number(ledger?.balance || 0);
      if (bal > 0.005) {
        toast.error(`Outstanding balance of $${bal.toFixed(2)}. Settle payment before checking out.`);
        setShowCheckOutDialog(false);
        folioRef.current?.expand();
        folioRef.current?.openPaymentDialog(bal, async () => { await performCheckOut(ledger?.id); });
        return;
      }

      // Update reservation status
      const { error: resErr } = await supabase
        .from("reservations")
        .update({ status: "CHECKED_OUT" })
        .eq("id", reservation.id);
      if (resErr) throw resErr;

      // Close the guest folio (balance is zero)
      const ledgerId = knownLedgerId || ledger?.id;
      if (ledgerId) {
        await supabase
          .from("ledger_accounts")
          .update({ is_active: false, closed_at: new Date().toISOString() })
          .eq("id", ledgerId);
      }

      toast.success("Guest checked out successfully");
      setShowCheckOutDialog(false);
      loadReservation();
    } catch (e: any) {
      console.error("Check-out error:", e);
      toast.error(e?.message || "Failed to check out guest");
    } finally {
      setCheckingOut(false);
    }
  };

  const handleCheckOutClick = async () => {
    if (!reservation) return;
    const { data: ledger } = await supabase
      .from("ledger_accounts")
      .select("id, balance")
      .eq("reservation_id", reservation.id)
      .eq("ledger_type", "guest")
      .eq("is_active", true)
      .maybeSingle();
    const bal = Number(ledger?.balance || 0);
    setCheckOutBalance(bal);
    if (bal > 0.005) {
      toast.info(`Balance due: $${bal.toFixed(2)} — take payment to complete check-out.`);
      folioRef.current?.expand();
      folioRef.current?.openPaymentDialog(bal, async () => { await performCheckOut(ledger?.id); });
      return;
    }
    setShowCheckOutDialog(true);
  };


  const handleCancelReservation = async () => {
    if (!reservation) return;
    
    setCancelling(true);
    
    try {
      // Check folio balance
      const { data: folioAccount } = await supabase
        .from("ledger_accounts")
        .select("id, balance")
        .eq("reservation_id", reservation.id)
        .eq("ledger_type", "guest")
        .eq("is_active", true)
        .maybeSingle();
      
      if (folioAccount && folioAccount.balance !== 0) {
        toast.error(`Cannot cancel - reservation has outstanding balance of $${Math.abs(folioAccount.balance).toFixed(2)}`);
        setCancelling(false);
        setShowCancelDialog(false);
        return;
      }
      
      // Check advance deposit balance
      const { data: depositAccount } = await supabase
        .from("ledger_accounts")
        .select("id, balance")
        .eq("reservation_id", reservation.id)
        .eq("ledger_type", "advance_deposit")
        .eq("is_active", true)
        .maybeSingle();
      
      if (depositAccount && depositAccount.balance !== 0) {
        toast.error(`Cannot cancel - reservation has deposit balance of $${Math.abs(depositAccount.balance).toFixed(2)}`);
        setCancelling(false);
        setShowCancelDialog(false);
        return;
      }
      
      const { error } = await supabase
        .from("reservations")
        .update({ status: "CANCELLED" })
        .eq("id", reservation.id);
      
      if (error) {
        console.error("Cancel error:", error);
        toast.error("Failed to cancel reservation");
        setCancelling(false);
        return;
      }
      
      toast.success("Reservation cancelled");
      setShowCancelDialog(false);
      navigate(getBackUrl());
    } catch (error) {
      console.error("Cancel error:", error);
      toast.error("Failed to cancel reservation");
    }
    
    setCancelling(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING": return "bg-yellow-500/10 text-yellow-700";
      case "CONFIRMED": return "bg-blue-500/10 text-blue-700";
      case "CHECKED_IN": return "bg-green-500/10 text-green-700";
      case "CHECKED_OUT": return "bg-gray-500/10 text-gray-700";
      case "CANCELLED": return "bg-red-500/10 text-red-700";
      case "NO_SHOW": return "bg-orange-500/10 text-orange-700";
      default: return "bg-gray-500/10 text-gray-700";
    }
  };

  const nights = checkInDate && checkOutDate 
    ? differenceInDays(parseISO(checkOutDate), parseISO(checkInDate)) 
    : 0;

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading reservation...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!reservation) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Reservation not found</p>
        </div>
      </DashboardLayout>
    );
  }

  const selectedSite = sites.find(s => s.id === selectedSiteId);

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-3">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => navigate(getBackUrl())}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-bold">Edit Reservation</h1>
                <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                  #{reservation.confirmation_number}
                </span>
                <Badge className={getStatusColor(reservation.status)} variant="secondary">
                  {reservation.status}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground break-words">
                {rates.find(r => r.id === selectedRateId)?.rate_code || reservation.rates?.rate_code || "No Rate"} • ${displayDailyRate !== null ? displayDailyRate.toFixed(2) : (nights > 0 ? (reservation.total_price / nights).toFixed(2) : '0.00')}/night • ${reservation.total_price.toFixed(2)} total
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 sm:shrink-0">
            <Button variant="outline" size="sm" onClick={() => setShowRegDialog(true)}>
              <Send className="h-3 w-3 mr-1" />
              Send
            </Button>
            {canCancel && (
              <Button variant="destructive" size="sm" onClick={() => setShowCancelDialog(true)}>
                <XCircle className="h-3 w-3 mr-1" />
                Cancel
              </Button>
            )}
            {canReinstate && (
              <Button variant="outline" size="sm" onClick={handleReinstateClick}>
                <RotateCcw className="h-3 w-3 mr-1" />
                Reinstate
              </Button>
            )}
            {isArrivingToday() && (
              <Button size="sm" onClick={handleProceedToCheckIn}>
                <CheckCircle className="h-3 w-3 mr-1" />
                Check-In
              </Button>
            )}
            {canCheckOut && (
              <Button
                size="sm"
                onClick={handleCheckOutClick}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <LogOut className="h-3 w-3 mr-1" />
                Check Out
              </Button>
            )}
          </div>
        </div>


        <RegistrationCardDialog
          open={showRegDialog}
          onOpenChange={setShowRegDialog}
          reservationId={reservation.id}
          defaultMode="print"
        />

        {/* Cancel Confirmation Dialog */}
        <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Reservation</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to cancel this reservation for {reservation.guests.first_name} {reservation.guests.last_name}? This action cannot be easily undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setShowCancelDialog(false)}>Keep Reservation</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleCancelReservation} 
                disabled={cancelling}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {cancelling ? "Cancelling..." : "Yes, Cancel Reservation"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Move Confirmation Dialog */}
        <AlertDialog open={showMoveConfirmDialog} onOpenChange={setShowMoveConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm {terminology.site} Move</AlertDialogTitle>
              <AlertDialogDescription>
                This guest is currently checked in. Are you sure you want to move them to a different {terminology.site.toLowerCase()}?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleCancelMove}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmMove}>Confirm Move</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Rate Change Confirmation Dialog */}
        <AlertDialog open={showRateChangeDialog} onOpenChange={setShowRateChangeDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Rate Change Detected</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div>
                  <p className="mb-3">
                    Changing to this {terminology.siteType.toLowerCase()} will affect the nightly rate:
                  </p>
                  <div className="p-3 bg-muted rounded-md space-y-1">
                    <div className="flex justify-between">
                      <span>Current rate:</span>
                      <span className="font-medium">${currentBasePrice?.toFixed(2)}/night</span>
                    </div>
                    <div className="flex justify-between">
                      <span>New rate:</span>
                      <span className="font-medium">${newBasePrice?.toFixed(2)}/night</span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex justify-between font-semibold">
                      <span>Difference:</span>
                      <span className={newBasePrice && currentBasePrice && newBasePrice > currentBasePrice ? "text-destructive" : "text-green-600"}>
                        {newBasePrice && currentBasePrice 
                          ? `${newBasePrice > currentBasePrice ? '+' : ''}$${(newBasePrice - currentBasePrice).toFixed(2)}/night`
                          : 'N/A'}
                      </span>
                    </div>
                  </div>
                  <p className="mt-3">Do you want to proceed with this {terminology.siteType.toLowerCase()} and rate change?</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleCancelRateChange}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmRateChange}>Confirm Rate Change</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Reinstate Dialog */}
        <AlertDialog open={showReinstateDialog} onOpenChange={setShowReinstateDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reinstate Reservation</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-4">
                  {reservation?.status === "CHECKED_OUT" ? (
                    <p>
                      This will reinstate the guest back to <strong>CHECKED IN</strong> status. 
                      They will be placed back in their assigned {terminology.site.toLowerCase()}.
                    </p>
                  ) : needsDateAdjustment ? (
                    <p className="text-amber-600">
                      The original check-in date ({formatLocalDate(reservation.check_in_date, "MMM d, yyyy")}) is before the audit date. 
                      Please confirm the new dates below.
                    </p>
                  ) : (
                    <p>
                      This will reinstate the reservation with status CONFIRMED. 
                      The original dates will be preserved.
                    </p>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div>
                      <Label>Check-In Date</Label>
                      <Input
                        type="date"
                        value={reinstateCheckIn}
                        onChange={(e) => setReinstateCheckIn(e.target.value)}
                        min={auditDate || undefined}
                      />
                    </div>
                    <div>
                      <Label>Check-Out Date</Label>
                      <Input
                        type="date"
                        value={reinstateCheckOut}
                        onChange={(e) => setReinstateCheckOut(e.target.value)}
                        min={reinstateCheckIn || undefined}
                      />
                    </div>
                  </div>
                  
                  {reinstateCheckIn && reinstateCheckOut && (
                    <p className="text-sm text-muted-foreground">
                      {differenceInDays(parseISO(reinstateCheckOut), parseISO(reinstateCheckIn))} night(s)
                    </p>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={reinstating}>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleReinstate} 
                disabled={reinstating || !reinstateCheckIn || !reinstateCheckOut || reinstateCheckIn >= reinstateCheckOut}
              >
                {reinstating ? "Reinstating..." : "Reinstate"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Left Column */}
          <div className="space-y-3">
            {/* Stay Details */}
            <Card className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-4 w-4 text-primary" />
                <h2 className="font-semibold text-sm">Stay Details</h2>
                <span className="text-xs text-muted-foreground ml-auto">{nights} night{nights !== 1 ? "s" : ""}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Check-In</Label>
                  <Input
                    type="date"
                    className="h-8 text-sm"
                    value={checkInDate}
                    onChange={(e) => setCheckInDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Check-Out</Label>
                  <Input
                    type="date"
                    className="h-8 text-sm"
                    value={checkOutDate}
                    onChange={(e) => setCheckOutDate(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                <div className="col-span-2 sm:col-span-1">
                  <Label className="text-xs">Rate Code</Label>
                  <Select 
                    value={selectedRateId || "none"} 
                    onValueChange={(value) => handleRateChange(value === "none" ? null : value)}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Select rate" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Rate</SelectItem>
                      {rates.map((rate) => (
                        <SelectItem key={rate.id} value={rate.id}>
                          {rate.rate_code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Adults</Label>
                  <Input
                    type="number"
                    className="h-8 text-sm"
                    value={adultsCount}
                    onChange={(e) => setAdultsCount(parseInt(e.target.value) || 1)}
                    min={1}
                  />
                </div>
                <div>
                  <Label className="text-xs">Children</Label>
                  <Input
                    type="number"
                    className="h-8 text-sm"
                    value={childrenCount}
                    onChange={(e) => setChildrenCount(parseInt(e.target.value) || 0)}
                    min={0}
                  />
                </div>
              </div>
            </Card>

            {/* Site Assignment */}
            <Card className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="h-4 w-4 text-primary" />
                <h2 className="font-semibold text-sm">{terminology.site} Assignment</h2>
                {groupBlockId && (
                  <Badge variant="secondary" className="text-xs gap-1">
                    <Users className="h-3 w-3" />
                    {groupBlockCode || "Group"}
                  </Badge>
                )}
                {selectedSite && (
                  <Badge variant="outline" className="ml-auto text-xs">
                    {selectedSite.site_types.code || selectedSite.site_types.name} #{selectedSite.site_number}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">{terminology.siteType}</Label>
                  <Select 
                    value={selectedSiteTypeId} 
                    onValueChange={handleSiteTypeChange}
                    disabled={isNonMasterSharer}
                  >
                    <SelectTrigger className={cn("h-8 text-sm", isNonMasterSharer && "opacity-60")}>
                      <SelectValue placeholder={`Select ${terminology.siteType.toLowerCase()}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {siteTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>
                          {type.name} - ${type.base_price.toFixed(2)}/night
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{terminology.site}</Label>
                  <div className="flex items-center gap-2">
                    <Select 
                      value={selectedSiteId || "unassigned"} 
                      onValueChange={handleSiteChange}
                      disabled={isNonMasterSharer || (assignmentLocked && !isAdmin)}
                    >
                      <SelectTrigger className={cn("h-8 text-sm flex-1", (isNonMasterSharer || (assignmentLocked && !isAdmin)) && "opacity-60")}>
                        <SelectValue placeholder={`Select ${terminology.site.toLowerCase()}`} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned" className="text-muted-foreground">
                          Unassigned
                        </SelectItem>
                        {filteredSites.map((site) => (
                          <SelectItem key={site.id} value={site.id}>
                            #{site.site_number} - {site.site_types.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-1.5">
                            <Checkbox
                              id="assignment-lock"
                              checked={assignmentLocked}
                              onCheckedChange={(checked) => {
                                // Can always lock, but only admin can unlock
                                if (!checked && originalAssignmentLocked && !isAdmin) {
                                  toast.error("Only an admin can unlock the room assignment");
                                  return;
                                }
                                setAssignmentLocked(checked === true);
                              }}
                              disabled={originalAssignmentLocked && !isAdmin}
                            />
                            <label 
                              htmlFor="assignment-lock" 
                              className={cn(
                                "flex items-center gap-1 cursor-pointer text-xs",
                                assignmentLocked ? "text-amber-600" : "text-muted-foreground"
                              )}
                            >
                              {assignmentLocked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
                            </label>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{assignmentLocked 
                            ? (isAdmin ? "Assignment locked - click to unlock" : "Assignment locked by admin") 
                            : "Lock room assignment"}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>
              </div>
              {isNonMasterSharer && (
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {terminology.site} assignment is controlled by the master reservation
                </p>
              )}
              {assignmentLocked && !isAdmin && !isNonMasterSharer && (
                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  {terminology.site} assignment is locked. Contact an admin to change.
                </p>
              )}
            </Card>

            {/* City Ledger */}
            <Card className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <Building className="h-4 w-4 text-primary" />
                <h2 className="font-semibold text-sm">Direct Bill / City Ledger</h2>
                {reservation?.city_ledger?.company_name && (
                  <Badge variant="secondary" className="ml-auto text-xs gap-1">
                    <Building className="h-3 w-3" />
                    {reservation.city_ledger.company_name}
                  </Badge>
                )}
              </div>

              <div className="space-y-2">
                <div>
                  <Label className="text-xs">City Ledger Account</Label>
                  <Select 
                    value={selectedCityLedgerId} 
                    onValueChange={setSelectedCityLedgerId}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="No city ledger assigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {cityLedgers.map((cl) => (
                        <SelectItem key={cl.id} value={cl.id}>
                          {cl.company_name || "Unnamed"} {cl.account_number ? `(${cl.account_number})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Billing Instructions</Label>
                  <Input
                    value={billingInstructions}
                    onChange={(e) => setBillingInstructions(e.target.value)}
                    placeholder="e.g., Room & tax only"
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column - Guest Information */}
          <Card className="p-3 h-fit">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-primary" />
              <h2 className="font-semibold text-sm">Guest Information</h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <Label className="text-xs">Title</Label>
                <Select value={title} onValueChange={setTitle}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Mr.">Mr.</SelectItem>
                    <SelectItem value="Mrs.">Mrs.</SelectItem>
                    <SelectItem value="Ms.">Ms.</SelectItem>
                    <SelectItem value="Dr.">Dr.</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">First Name *</Label>
                <Input
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  className="h-8 text-sm"
                />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Last Name *</Label>
                <Input
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <Separator className="my-2" />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <Label className="text-xs">Email *</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Phone 1</Label>
                <Input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Phone 2</Label>
                <Input
                  type="tel"
                  value={phone2}
                  onChange={(e) => setPhone2(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <Separator className="my-2" />

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Street Address</Label>
                <Input
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">City</Label>
                <Input
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <div>
                <Label className="text-xs">State</Label>
                <Input
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">Zip</Label>
                <Input
                  value={zipcode}
                  onChange={(e) => setZipcode(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
            </div>

            <div className="mt-2">
              <Label className="text-xs">Special Requests</Label>
              <Input
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                placeholder="Any special requests or notes"
                className="h-8 text-sm"
              />
            </div>
          </Card>
        </div>

        {/* Shared Reservations / Share Group */}
        {reservation && (
          <ShareGroupCard
            reservationId={reservation.id}
            propertyId={reservation.property_id}
            shareGroup={shareGroup}
            loading={shareGroupLoading}
            onAddSharer={addSharer}
            onRemoveSharer={removeSharer}
            onRefresh={loadShareGroup}
          />
        )}

        {/* Deposit Management - show for PENDING, CONFIRMED, CANCELLED, NO_SHOW */}
        {reservation && ["PENDING", "CONFIRMED", "CANCELLED", "NO_SHOW"].includes(reservation.status) && (
          <DepositManagementCard
            reservationId={reservation.id}
            reservationStatus={reservation.status}
            totalCharges={reservation.total_price}
            firstNightRate={reservation.sites?.site_types?.base_price || 0}
            numberOfNights={nights}
            numberOfAdults={adultsCount}
            revenueAccountId={reservation.rates?.revenue_account_id}
            guestId={reservation.guest_id}
            propertyId={reservation.property_id}
          />
        )}

        {/* Folio - shown for all reservations */}
        {reservation && (
          <div ref={folioSectionRef} id="folio-section" className="scroll-mt-24">
            <FolioDetail
              ref={folioRef}
              reservationId={reservation.id}
              defaultCollapsed={!(focusParam === "folio" || quickPost)}
            />
          </div>
        )}

        {/* Prominent Check-Out call to action for checked-in guests */}
        {canCheckOut && (
          <Card className="p-4 border-green-600/40 bg-green-50 dark:bg-green-950/20">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="font-semibold text-green-900 dark:text-green-100">
                  Ready to check out this guest?
                </div>
                <p className="text-sm text-muted-foreground">
                  Settle any remaining balance on the folio, then click Check Out to complete the stay.
                </p>
              </div>
              <Button
                size="lg"
                onClick={handleCheckOutClick}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Check Out Guest
              </Button>
            </div>
          </Card>
        )}


        {/* Payment Cards */}
        {reservation && (
          <PaymentCardList 
            reservationId={reservation.id} 
            propertyId={reservation.property_id}
          />
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate(getBackUrl())}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-1" />
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>

        {/* Check-Out Confirmation Dialog */}
        <AlertDialog open={showCheckOutDialog} onOpenChange={setShowCheckOutDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Check Out Guest</AlertDialogTitle>
              <AlertDialogDescription>
                Confirm check-out for {reservation?.guests.first_name} {reservation?.guests.last_name} (#{reservation?.confirmation_number}).
                The folio balance is <strong>${checkOutBalance.toFixed(2)}</strong>. This will mark the reservation as CHECKED_OUT and close the folio.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={checkingOut}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); performCheckOut(); }}
                disabled={checkingOut}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {checkingOut ? "Checking out..." : "Yes, Check Out"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>

  );
};

export default ReservationEdit;
