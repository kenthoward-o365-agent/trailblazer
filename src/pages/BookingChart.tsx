import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, ChevronLeft, ChevronRight, Plus, Ban, AlertTriangle, LayoutGrid, Circle, ChevronDown, ExternalLink, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, addDays, isSameDay, isWithinInterval, parseISO } from "date-fns";
import { formatLocalDate } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useProperty } from "@/contexts/PropertyContext";
import { usePropertyTerminology } from "@/hooks/usePropertyTerminology";

interface VisibleGroupBlock {
  id: string;
  code: string;
  description: string | null;
  startDate: string;
  endDate: string;
  roomTypes: { siteTypeId: string; name: string; maxRoomsBlocked: number }[];
}

interface Site {
  id: string;
  site_number: string;
  site_type_id: string;
  site_type_name: string;
  housekeeping_status: string | null;
  occupancy_status: string | null;
}

interface Reservation {
  id: string;
  site_id: string;
  check_in_date: string;
  check_out_date: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  status: string;
  total_price: number;
  guests_count: number;
  special_requests: string | null;
  group_block_id: string | null;
}

interface GroupBlockAllocation {
  id: string;
  allocation_date: string;
  site_type_id: string | null;
  site_id: string | null;
  rooms_blocked: number;
  group_code: string;
  group_block_id: string;
  group_description: string | null;
  group_start_date: string;
  group_end_date: string;
}

export default function BookingChart() {
  const navigate = useNavigate();
  const { selectedProperty } = useProperty();
  const terminology = usePropertyTerminology();
  const [sites, setSites] = useState<Site[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [daysToShow] = useState(10);
  const [showRates, setShowRates] = useState(false);
  const [viewBySiteType, setViewBySiteType] = useState(false);
  const [hasSetDefaultView, setHasSetDefaultView] = useState(false);

  // Campground PMS: always default to site-number view (no floating inventory).
  useEffect(() => {
    if (selectedProperty && !hasSetDefaultView) {
      setViewBySiteType(false);
      setHasSetDefaultView(true);
    }
  }, [selectedProperty, hasSetDefaultView]);
  const [siteTypeRates, setSiteTypeRates] = useState<Record<string, number>>({});
  const [rateSeasons, setRateSeasons] = useState<{ start_date: string; end_date: string; multiplier: number }[]>([]);
  const [siteTypes, setSiteTypes] = useState<{ id: string; name: string; siteCount: number }[]>([]);
  const [groupAllocations, setGroupAllocations] = useState<GroupBlockAllocation[]>([]);
  const [chartRates, setChartRates] = useState<{ id: string; rate_code: string; description: string | null; is_default: boolean }[]>([]);
  const [selectedChartRateId, setSelectedChartRateId] = useState<string>("");

  // Drag selection state (for creating new reservations by site)
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ siteId: string; date: Date } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ siteId: string; date: Date } | null>(null);

  // Room type drag selection state (for type_floating mode)
  const [isTypeDragging, setIsTypeDragging] = useState(false);
  const [typeDragStart, setTypeDragStart] = useState<{ siteTypeId: string; date: Date } | null>(null);
  const [typeDragEnd, setTypeDragEnd] = useState<{ siteTypeId: string; date: Date } | null>(null);

  // Reservation drag-and-drop state
  const [draggingReservation, setDraggingReservation] = useState<Reservation | null>(null);
  const [dropTarget, setDropTarget] = useState<{ siteId: string; date: Date } | null>(null);

  // Reservation detail dialog
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);

  // Quick charge dialog state
  const [isChargeDialogOpen, setIsChargeDialogOpen] = useState(false);
  const [chargeAccounts, setChargeAccounts] = useState<any[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [chargeAmount, setChargeAmount] = useState("");
  const [chargeDescription, setChargeDescription] = useState("");
  const [isPostingCharge, setIsPostingCharge] = useState(false);

  const loadChargeAccounts = async (reservationId: string) => {
    const { data: reservation } = await supabase
      .from("reservations")
      .select("property_id")
      .eq("id", reservationId)
      .single();

    if (!reservation) return;

    const { data } = await supabase
      .from("accounts")
      .select(`
        id, code, name,
        account_groups (name, account_type)
      `)
      .eq("property_id", reservation.property_id)
      .eq("is_active", true)
      .order("code");

    const revenueAccounts = data?.filter(
      (a: any) => a.account_groups?.account_type === "revenue"
    ) || [];

    setChargeAccounts(revenueAccounts);
    if (revenueAccounts.length > 0) {
      setSelectedAccountId(revenueAccounts[0].id);
    }
  };

  const handleOpenChargeDialog = () => {
    if (selectedReservation) {
      setSelectedAccountId("");
      setChargeAmount("");
      setChargeDescription("");
      setIsChargeDialogOpen(true);
      loadChargeAccounts(selectedReservation.id);
    }
  };

  useEffect(() => {
    if (selectedProperty?.id) {
      loadData();
    }
  }, [startDate, selectedProperty?.id]);

  // Reload site-type prices when the user picks a different rate from the Show Rates dropdown
  useEffect(() => {
    const reloadPricesForRate = async () => {
      if (!selectedProperty?.id || !selectedChartRateId) return;

      // Rebuild the full price map from base_price so previously-added bundles don't stack
      const { data: siteTypesData } = await supabase
        .from("site_types")
        .select("id, base_price")
        .eq("property_id", selectedProperty.id);

      const [{ data: ratePrices }, bundledAddOnTotal] = await Promise.all([
        supabase
          .from("rate_site_type_prices")
          .select("site_type_id, price")
          .eq("rate_id", selectedChartRateId),
        getBundledAddOnTotal(selectedChartRateId),
      ]);

      const next: Record<string, number> = {};
      (siteTypesData || []).forEach((st: any) => { next[st.id] = Number(st.base_price) || 0; });
      (ratePrices || []).forEach(rp => { next[rp.site_type_id] = Number(rp.price); });
      // Add bundled add-on total to every site-type price
      Object.keys(next).forEach(k => { next[k] = next[k] + bundledAddOnTotal; });
      setSiteTypeRates(next);
    };
    reloadPricesForRate();
  }, [selectedChartRateId, selectedProperty?.id]);

  // Sum the price of all add-ons bundled to a rate (package items)
  const getBundledAddOnTotal = async (rateId: string): Promise<number> => {
    if (!rateId) return 0;
    const { data } = await supabase
      .from("rate_add_ons")
      .select("add_ons(price)")
      .eq("rate_id", rateId);
    if (!data) return 0;
    return data.reduce((sum: number, row: any) => sum + Number(row.add_ons?.price || 0), 0);
  };



  const loadData = async () => {
    if (!selectedProperty?.id) return;
    
    setLoading(true);
    const propertyId = selectedProperty.id;
    const endDate = addDays(startDate, daysToShow);

    // Load sites with site types
    const { data: sitesData } = await supabase
      .from("sites")
      .select(`
        id,
        site_number,
        site_type_id,
        site_types(name)
      `)
      .eq("property_id", propertyId)
      .eq("is_active", true);

    if (sitesData) {
      const formattedSites = sitesData
        .filter((site: any) => site.site_number !== '*Out') // Exclude system *Out site
        .map((site: any) => ({
          id: site.id,
          site_number: site.site_number,
          site_type_id: site.site_type_id,
          site_type_name: site.site_types?.name || "Unknown",
          housekeeping_status: null,
          occupancy_status: null,
        }));


      // Sort: numeric first, then alpha
      formattedSites.sort((a, b) => {
        const aNum = parseInt(a.site_number);
        const bNum = parseInt(b.site_number);
        const aIsNum = !isNaN(aNum);
        const bIsNum = !isNaN(bNum);

        if (aIsNum && bIsNum) return aNum - bNum;
        if (aIsNum && !bIsNum) return -1;
        if (!aIsNum && bIsNum) return 1;
        return a.site_number.localeCompare(b.site_number);
      });

      setSites(formattedSites);
    }

    // Load reservations for date range
    const { data: reservationsData } = await supabase
      .from("reservations")
      .select(`
        id,
        site_id,
        check_in_date,
        check_out_date,
        status,
        total_price,
        guests_count,
        special_requests,
        group_block_id,
        guests(first_name, last_name, email, phone)
      `)
      .eq("property_id", propertyId)
      .neq("status", "CANCELLED")
      .lte("check_in_date", format(endDate, "yyyy-MM-dd"))
      .gte("check_out_date", format(startDate, "yyyy-MM-dd"));

    if (reservationsData) {
      const formattedReservations = reservationsData.map((res: any) => ({
        id: res.id,
        site_id: res.site_id,
        check_in_date: res.check_in_date,
        check_out_date: res.check_out_date,
        guest_name: `${res.guests?.last_name || ""}, ${res.guests?.first_name || ""}`.trim(),
        guest_email: res.guests?.email || "",
        guest_phone: res.guests?.phone || "",
        status: res.status,
        total_price: res.total_price,
        guests_count: res.guests_count,
        special_requests: res.special_requests,
        group_block_id: res.group_block_id,
      }));
      setReservations(formattedReservations);
    }

    // Load group block allocations for active/definite blocks (moved up to use in site types processing)
    const { data: allocationsData } = await supabase
      .from("group_block_room_allocations")
      .select(`
        id,
        allocation_date,
        site_type_id,
        site_id,
        rooms_blocked,
        group_blocks!inner (
          id,
          code,
          description,
          start_date,
          end_date,
          property_id,
          status
        )
      `)
      .eq("group_blocks.property_id", propertyId)
      .in("group_blocks.status", ["active", "definite"])
      .gte("allocation_date", format(startDate, "yyyy-MM-dd"))
      .lte("allocation_date", format(endDate, "yyyy-MM-dd"));

    if (allocationsData) {
      setGroupAllocations(allocationsData.map((a: any) => ({
        id: a.id,
        allocation_date: a.allocation_date,
        site_type_id: a.site_type_id,
        site_id: a.site_id,
        rooms_blocked: a.rooms_blocked,
        group_code: a.group_blocks.code,
        group_block_id: a.group_blocks.id,
        group_description: a.group_blocks.description,
        group_start_date: a.group_blocks.start_date,
        group_end_date: a.group_blocks.end_date
      })));
    } else {
      setGroupAllocations([]);
    }

    // Load base prices by site type and count sites per type
    const { data: siteTypesData } = await supabase
      .from("site_types")
      .select("id, name, base_price")
      .eq("property_id", propertyId);

    // Load rates flagged for Booking Chart
    const { data: chartRatesData } = await supabase
      .from("rates")
      .select("id, rate_code, description, is_default")
      .eq("property_id", propertyId)
      .eq("show_on_booking_chart", true)
      .order("rate_code");

    const chartRatesList = chartRatesData || [];
    setChartRates(chartRatesList);

    // Pick initial rate: keep current selection if still valid, else default flag, else first
    let activeRateId = selectedChartRateId;
    if (!activeRateId || !chartRatesList.some(r => r.id === activeRateId)) {
      activeRateId = chartRatesList.find(r => r.is_default)?.id || chartRatesList[0]?.id || "";
      setSelectedChartRateId(activeRateId);
    }

    if (siteTypesData && sitesData) {
      const priceMap: Record<string, number> = {};
      const typesWithCount = siteTypesData.map((st: any) => {
        priceMap[st.id] = st.base_price; // Fallback to base_price
        const siteCount = sitesData.filter((s: any) => s.site_type_id === st.id).length;
        return { id: st.id, name: st.name, siteCount };
      });

      // Use active chart rate (if any) for prices; otherwise fall back to the default rate
      let priceRateId = activeRateId;
      if (!priceRateId) {
        const { data: defaultRate } = await supabase
          .from("rates")
          .select("id")
          .eq("property_id", propertyId)
          .eq("is_default", true)
          .maybeSingle();
        priceRateId = defaultRate?.id || "";
      }

      if (priceRateId) {
        const [{ data: ratePrices }, bundledAddOnTotal] = await Promise.all([
          supabase
            .from("rate_site_type_prices")
            .select("site_type_id, price")
            .eq("rate_id", priceRateId),
          getBundledAddOnTotal(priceRateId),
        ]);

        if (ratePrices) {
          ratePrices.forEach(rp => {
            priceMap[rp.site_type_id] = Number(rp.price) + bundledAddOnTotal;
          });
        }
        // Also include bundled add-ons in fallback base prices for site types without an override
        if (bundledAddOnTotal > 0) {
          Object.keys(priceMap).forEach(k => {
            if (!ratePrices?.some(rp => rp.site_type_id === k)) {
              priceMap[k] = Number(priceMap[k]) + bundledAddOnTotal;
            }
          });
        }
      }


      setSiteTypeRates(priceMap);
      
      // Get site type IDs that have group allocations in current date range
      const siteTypesWithGroupAllocations = new Set<string>();
      allocationsData?.forEach((a: any) => {
        if (a.site_type_id) {
          siteTypesWithGroupAllocations.add(a.site_type_id);
        }
      });
      
      // Include site types with rooms OR with group allocations (even if 0 rooms)
      // Exclude "System" site type (used for *Out adjustment room)
      setSiteTypes(typesWithCount.filter(t => 
        t.name !== 'System' && (t.siteCount > 0 || siteTypesWithGroupAllocations.has(t.id))
      ));
    }

    // Load rate seasons for seasonal adjustments
    const { data: seasonsData } = await supabase
      .from("seasons")
      .select("start_date, end_date, multiplier")
      .eq("property_id", propertyId);

    if (seasonsData) {
      setRateSeasons(seasonsData);
    }

    setLoading(false);
  };

  const getDates = (): Date[] => {
    const dates: Date[] = [];
    for (let i = 0; i < daysToShow; i++) {
      dates.push(addDays(startDate, i));
    }
    return dates;
  };

  const getRateForDate = (siteTypeId: string, date: Date): number | null => {
    const baseRate = siteTypeRates[siteTypeId];
    if (!baseRate) return null;

    const dateStr = format(date, "yyyy-MM-dd");
    
    // Find applicable season
    const applicableSeason = rateSeasons.find(season => 
      dateStr >= season.start_date && dateStr <= season.end_date
    );

    if (applicableSeason) {
      return baseRate * applicableSeason.multiplier;
    }
    
    return baseRate;
  };

  // Calculate availability by site type for a given date
  const getAvailabilityBySiteType = (siteTypeId: string, date: Date): number => {
    const sitesOfType = sites.filter(s => s.site_type_id === siteTypeId);
    const dateStr = format(date, "yyyy-MM-dd");
    
    // Count rooms occupied by actual reservations
    const occupiedCount = sitesOfType.filter(site => {
      return reservations.some(res => {
        if (res.site_id !== site.id) return false;
        const checkIn = parseISO(res.check_in_date);
        const checkOut = parseISO(res.check_out_date);
        return isWithinInterval(date, { start: checkIn, end: addDays(checkOut, -1) });
      });
    }).length;
    
    // Count group block allocations BY SITE TYPE (rooms_blocked count)
    const groupBlockedByType = groupAllocations
      .filter(a => a.allocation_date === dateStr && a.site_type_id === siteTypeId && !a.site_id)
      .reduce((sum, a) => sum + a.rooms_blocked, 0);
    
    // Count group block allocations BY SPECIFIC ROOM for this site type
    // BUT exclude rooms that already have a reservation from the SAME group block
    const groupBlockedByRoom = groupAllocations
      .filter(a => {
        if (a.allocation_date !== dateStr) return false;
        if (!a.site_id) return false;
        if (!sitesOfType.some(s => s.id === a.site_id)) return false;
        
        // Check if this room has a reservation from THIS group block on this date
        const hasGroupReservation = reservations.some(res => {
          if (res.site_id !== a.site_id) return false;
          if (res.group_block_id !== a.group_block_id) return false;
          const checkIn = parseISO(res.check_in_date);
          const checkOut = parseISO(res.check_out_date);
          return isWithinInterval(date, { start: checkIn, end: addDays(checkOut, -1) });
        });
        
        // Only count as blocked if there's NO reservation from this group
        return !hasGroupReservation;
      }).length;
    
    return sitesOfType.length - occupiedCount - groupBlockedByType - groupBlockedByRoom;
  };

  // Check if a site type has group block allocations in current date range
  const hasGroupBlockAllocations = (siteTypeId: string): boolean => {
    return groupAllocations.some(a => a.site_type_id === siteTypeId);
  };

  // Compute visible group blocks for the panel
  const visibleGroupBlocks = useMemo((): VisibleGroupBlock[] => {
    // Group allocations by group_block_id
    const groupMap = new Map<string, {
      id: string;
      code: string;
      description: string | null;
      startDate: string;
      endDate: string;
      roomTypeMap: Map<string, { siteTypeId: string; name: string; maxRoomsBlocked: number }>;
    }>();

    groupAllocations.forEach(alloc => {
      if (!groupMap.has(alloc.group_block_id)) {
        groupMap.set(alloc.group_block_id, {
          id: alloc.group_block_id,
          code: alloc.group_code,
          description: alloc.group_description,
          startDate: alloc.group_start_date,
          endDate: alloc.group_end_date,
          roomTypeMap: new Map()
        });
      }

      const group = groupMap.get(alloc.group_block_id)!;
      
      // Handle site type allocations
      if (alloc.site_type_id) {
        const siteType = siteTypes.find(st => st.id === alloc.site_type_id);
        const typeName = siteType?.name || "Unknown";
        
        if (!group.roomTypeMap.has(alloc.site_type_id)) {
          group.roomTypeMap.set(alloc.site_type_id, {
            siteTypeId: alloc.site_type_id,
            name: typeName,
            maxRoomsBlocked: alloc.rooms_blocked
          });
        } else {
          // Track max rooms blocked on any single date
          const existing = group.roomTypeMap.get(alloc.site_type_id)!;
          existing.maxRoomsBlocked = Math.max(existing.maxRoomsBlocked, alloc.rooms_blocked);
        }
      }
      
      // Handle specific room allocations
      if (alloc.site_id) {
        const site = sites.find(s => s.id === alloc.site_id);
        if (site) {
          const typeName = site.site_type_name;
          if (!group.roomTypeMap.has(site.site_type_id)) {
            group.roomTypeMap.set(site.site_type_id, {
              siteTypeId: site.site_type_id,
              name: typeName,
              maxRoomsBlocked: 1
            });
          } else {
            const existing = group.roomTypeMap.get(site.site_type_id)!;
            existing.maxRoomsBlocked = Math.max(existing.maxRoomsBlocked, existing.maxRoomsBlocked);
          }
        }
      }
    });

    return Array.from(groupMap.values()).map(group => ({
      id: group.id,
      code: group.code,
      description: group.description,
      startDate: group.startDate,
      endDate: group.endDate,
      roomTypes: Array.from(group.roomTypeMap.values())
    }));
  }, [groupAllocations, siteTypes, sites]);

  // Calculate total availability across all site types for a given date
  const getTotalAvailability = (date: Date): number => {
    return siteTypes.reduce((total, siteType) => {
      return total + getAvailabilityBySiteType(siteType.id, date);
    }, 0);
  };

  // Calculate occupancy percentage for a given date
  const getOccupancyPercentage = (date: Date): number => {
    if (sites.length === 0) return 0;
    const available = getTotalAvailability(date);
    const occupied = sites.length - available;
    return Math.round((occupied / sites.length) * 100);
  };

  // Get color class for occupancy percentage
  const getOccupancyColor = (percentage: number): string => {
    if (percentage <= 50) return "text-green-600 dark:text-green-400";
    if (percentage <= 80) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  // Get group block for a specific room on a specific date
  const getGroupBlockForCell = (siteId: string, date: Date): GroupBlockAllocation | undefined => {
    const dateStr = format(date, "yyyy-MM-dd");
    return groupAllocations.find(a => 
      a.site_id === siteId && 
      a.allocation_date === dateStr
    );
  };

  // Calculate how many consecutive days a group block spans from a given date
  const getGroupBlockSpan = (block: GroupBlockAllocation, fromDate: Date): number => {
    let span = 1;
    let checkDate = addDays(fromDate, 1);
    const endDate = addDays(startDate, daysToShow);
    
    while (checkDate < endDate) {
      const hasBlock = groupAllocations.some(a => 
        a.site_id === block.site_id && 
        a.group_block_id === block.group_block_id &&
        a.allocation_date === format(checkDate, "yyyy-MM-dd")
      );
      if (!hasBlock) break;
      span++;
      checkDate = addDays(checkDate, 1);
    }
    return span;
  };

  // Determine if we should render the group block bar on this date
  const isGroupBlockVisibleStart = (block: GroupBlockAllocation, date: Date): boolean => {
    const dateStr = format(date, "yyyy-MM-dd");
    if (block.allocation_date !== dateStr) return false;
    
    // Check if previous day is also blocked by same group
    const prevDateStr = format(addDays(date, -1), "yyyy-MM-dd");
    const prevBlock = groupAllocations.find(a =>
      a.site_id === block.site_id &&
      a.group_block_id === block.group_block_id &&
      a.allocation_date === prevDateStr
    );
    
    // Show at start if previous day is not blocked or is before visible range
    return !prevBlock || parseISO(prevDateStr) < startDate;
  };

  const getReservationForCell = (siteId: string, date: Date): Reservation | null => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return reservations.find((res) => {
      if (res.site_id !== siteId) return false;
      // Compare as strings to avoid timezone issues
      const checkIn = res.check_in_date;
      const checkOutDate = parseISO(res.check_out_date);
      const lastNightStr = format(addDays(checkOutDate, -1), 'yyyy-MM-dd');
      return dateStr >= checkIn && dateStr <= lastNightStr;
    }) || null;
  };

  const isReservationStart = (siteId: string, date: Date): boolean => {
    return reservations.some((res) => {
      if (res.site_id !== siteId) return false;
      return isSameDay(parseISO(res.check_in_date), date);
    });
  };

  // Determine if we should render the reservation bar on this date
  // Either it's the actual check-in date, OR the reservation started before the visible range
  // and this is the first day of the visible range
  const isReservationVisibleStart = (reservation: Reservation, date: Date): boolean => {
    const checkIn = parseISO(reservation.check_in_date);
    // If this is the actual check-in date
    if (isSameDay(checkIn, date)) return true;
    // If check-in is before the visible start date and this is the first visible date
    if (checkIn < startDate && isSameDay(date, startDate)) return true;
    return false;
  };

  const getReservationSpan = (reservation: Reservation, date: Date): number => {
    const checkIn = parseISO(reservation.check_in_date);
    const checkOut = parseISO(reservation.check_out_date);
    const endDate = addDays(startDate, daysToShow);

    // If check-in is before the visible range, use startDate as effective start
    const effectiveStart = checkIn < startDate ? startDate : checkIn;
    
    // Calculate days from effective start to checkout or end of visible range
    let spanEnd = checkOut;
    if (checkOut > endDate) spanEnd = endDate;

    const daysFromStart = Math.ceil((spanEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(1, daysFromStart);
  };

  const handleCellMouseDown = (siteId: string, date: Date) => {
    // Check if there's already a reservation on this cell
    if (getReservationForCell(siteId, date)) return;

    setIsDragging(true);
    setDragStart({ siteId, date });
    setDragEnd({ siteId, date });
  };

  const handleCellMouseEnter = (siteId: string, date: Date) => {
    if (!isDragging || !dragStart) return;
    // Only allow dragging on same site
    if (siteId !== dragStart.siteId) return;
    setDragEnd({ siteId, date });
  };

  const handleCellMouseUp = () => {
    if (!isDragging || !dragStart || !dragEnd) {
      setIsDragging(false);
      return;
    }

    const site = sites.find((s) => s.id === dragStart.siteId);
    if (!site) {
      setIsDragging(false);
      setDragStart(null);
      setDragEnd(null);
      return;
    }

    // Determine start and end dates
    const selectionStart = dragStart.date <= dragEnd.date ? dragStart.date : dragEnd.date;
    const selectionEnd = dragStart.date <= dragEnd.date ? dragEnd.date : dragStart.date;

    // Navigate to booking page
    const params = new URLSearchParams({
      site_id: site.id,
      check_in: format(selectionStart, "yyyy-MM-dd"),
      check_out: format(addDays(selectionEnd, 1), "yyyy-MM-dd"),
    });

    navigate(`/book?${params.toString()}`);

    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  };

  const handleCellDoubleClick = (siteId: string, date: Date) => {
    // Check if there's already a reservation
    if (getReservationForCell(siteId, date)) return;

    const site = sites.find((s) => s.id === siteId);
    if (!site) return;

    // Navigate with open checkout date
    const params = new URLSearchParams({
      site_id: site.id,
      check_in: format(date, "yyyy-MM-dd"),
    });

    navigate(`/book?${params.toString()}`);
  };

  const isCellInSelection = (siteId: string, date: Date): boolean => {
    if (!isDragging || !dragStart || !dragEnd) return false;
    if (siteId !== dragStart.siteId) return false;

    const selectionStart = dragStart.date <= dragEnd.date ? dragStart.date : dragEnd.date;
    const selectionEnd = dragStart.date <= dragEnd.date ? dragEnd.date : dragStart.date;

    return date >= selectionStart && date <= selectionEnd;
  };

  // Room Type drag handlers (for type_floating mode)
  const resetTypeDrag = () => {
    setIsTypeDragging(false);
    setTypeDragStart(null);
    setTypeDragEnd(null);
  };

  const handleTypeCellMouseDown = (siteTypeId: string, date: Date) => {
    if (!terminology.isTypeFloating) return;
    setIsTypeDragging(true);
    setTypeDragStart({ siteTypeId, date });
    setTypeDragEnd({ siteTypeId, date });
  };

  const handleTypeCellMouseEnter = (siteTypeId: string, date: Date) => {
    if (!isTypeDragging || !typeDragStart) return;
    if (siteTypeId !== typeDragStart.siteTypeId) return;
    setTypeDragEnd({ siteTypeId, date });
  };

  const handleTypeCellMouseUp = () => {
    if (!isTypeDragging || !typeDragStart || !typeDragEnd) {
      resetTypeDrag();
      return;
    }

    const siteType = siteTypes.find(st => st.id === typeDragStart.siteTypeId);
    if (!siteType) {
      resetTypeDrag();
      return;
    }

    const selectionStart = typeDragStart.date <= typeDragEnd.date 
      ? typeDragStart.date : typeDragEnd.date;
    const selectionEnd = typeDragStart.date <= typeDragEnd.date 
      ? typeDragEnd.date : typeDragStart.date;

    const params = new URLSearchParams({
      site_type_id: siteType.id,
      check_in: format(selectionStart, "yyyy-MM-dd"),
      check_out: format(addDays(selectionEnd, 1), "yyyy-MM-dd"),
    });

    navigate(`/book?${params.toString()}`);
    resetTypeDrag();
  };

  const handleTypeCellDoubleClick = (siteTypeId: string, date: Date) => {
    if (!terminology.isTypeFloating) return;
    
    const siteType = siteTypes.find(st => st.id === siteTypeId);
    if (!siteType) return;

    const params = new URLSearchParams({
      site_type_id: siteType.id,
      check_in: format(date, "yyyy-MM-dd"),
    });

    navigate(`/book?${params.toString()}`);
  };

  const isTypeCellInSelection = (siteTypeId: string, date: Date): boolean => {
    if (!isTypeDragging || !typeDragStart || !typeDragEnd) return false;
    if (siteTypeId !== typeDragStart.siteTypeId) return false;

    const selectionStart = typeDragStart.date <= typeDragEnd.date 
      ? typeDragStart.date : typeDragEnd.date;
    const selectionEnd = typeDragStart.date <= typeDragEnd.date 
      ? typeDragEnd.date : typeDragStart.date;

    return date >= selectionStart && date <= selectionEnd;
  };

  const handlePrev10 = () => {
    setStartDate(addDays(startDate, -10));
  };

  const handleNext10 = () => {
    setStartDate(addDays(startDate, 10));
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setStartDate(date);
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case "CHECKED_IN":
        return "bg-emerald-600 dark:bg-emerald-500";
      case "CONFIRMED":
        return "bg-blue-500 dark:bg-blue-400";
      case "PENDING":
        return "bg-amber-500 dark:bg-amber-400";
      default:
        return "bg-primary";
    }
  };

  const handleReservationClick = (e: React.MouseEvent, reservation: Reservation) => {
    e.stopPropagation();
    setSelectedReservation(reservation);
  };

  const handleEditReservation = () => {
    if (!selectedReservation) return;
    navigate(`/reservation/edit?id=${selectedReservation.id}`);
  };

  const handleCheckInReservation = () => {
    if (!selectedReservation) return;
    navigate(`/check-in?reservation=${selectedReservation.id}`);
  };

  const handleViewFolio = () => {
    if (!selectedReservation) return;
    navigate(`/reservation/edit?id=${selectedReservation.id}&focus=folio`);
  };

  const isArrivingToday = (reservation: Reservation): boolean => {
    const today = format(new Date(), "yyyy-MM-dd");
    return reservation.check_in_date === today && reservation.status === "CONFIRMED";
  };


  const handlePostQuickCharge = async () => {
    if (!selectedReservation) return;
    
    const amount = parseFloat(chargeAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setIsPostingCharge(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const staffName = user?.user_metadata?.first_name 
        ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`
        : 'Staff';

      // Find the guest ledger for this reservation
      const { data: ledgerAccount } = await supabase
        .from("ledger_accounts")
        .select("id, balance")
        .eq("reservation_id", selectedReservation.id)
        .eq("ledger_type", "guest")
        .eq("is_active", true)
        .maybeSingle();

      if (!ledgerAccount) {
        toast.error("No active folio found for this guest");
        setIsPostingCharge(false);
        return;
      }

      // Get current running balance
      const { data: lastPosting } = await supabase
        .from("folio_postings")
        .select("running_balance")
        .eq("ledger_account_id", ledgerAccount.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const currentBalance = lastPosting?.running_balance || ledgerAccount.balance;
      const newBalance = currentBalance + amount;

      const selectedAccount = chargeAccounts.find((a: any) => a.id === selectedAccountId);
      const accountCode = selectedAccount?.code || "";
      const accountName = selectedAccount?.name || "Charge";

      // Post to folio_postings
      await supabase.from("folio_postings").insert({
        ledger_account_id: ledgerAccount.id,
        posting_type: "charge",
        account_id: selectedAccountId || null,
        description: chargeDescription || `${accountCode} - ${accountName}`,
        amount: amount,
        running_balance: newBalance,
        posted_by: user?.id,
        posted_by_name: staffName,
      });

      // Post to ledger_transactions
      await supabase.from("ledger_transactions").insert({
        ledger_account_id: ledgerAccount.id,
        transaction_type: "charge",
        account_id: selectedAccountId || null,
        account_code: accountCode,
        description: chargeDescription || `${accountCode} - ${accountName}`,
        debit_amount: amount,
        credit_amount: 0,
        posted_by_name: staffName,
      });

      // Update ledger account balance
      await supabase
        .from("ledger_accounts")
        .update({ balance: newBalance })
        .eq("id", ledgerAccount.id);

      toast.success(`$${amount.toFixed(2)} charge posted successfully`);
      setIsChargeDialogOpen(false);
      setSelectedReservation(null);
    } catch (error) {
      console.error("Error posting charge:", error);
      toast.error("Failed to post charge");
    } finally {
      setIsPostingCharge(false);
    }
  };

  // Reservation drag handlers
  const handleReservationDragStart = (e: React.DragEvent, reservation: Reservation) => {
    e.stopPropagation();
    setDraggingReservation(reservation);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", reservation.id);
  };

  const handleReservationDragEnd = () => {
    setDraggingReservation(null);
    setDropTarget(null);
  };

  const handleCellDragOver = (e: React.DragEvent, siteId: string, date: Date) => {
    if (!draggingReservation) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTarget({ siteId, date });
  };

  const handleCellDragLeave = () => {
    setDropTarget(null);
  };

  const handleCellDrop = async (e: React.DragEvent, siteId: string, date: Date) => {
    e.preventDefault();
    if (!draggingReservation) return;

    const reservation = draggingReservation;
    const originalSite = sites.find(s => s.id === reservation.site_id);
    const newSite = sites.find(s => s.id === siteId);

    if (!originalSite || !newSite) {
      setDraggingReservation(null);
      setDropTarget(null);
      return;
    }

    // Calculate the duration of the reservation
    const originalCheckIn = parseISO(reservation.check_in_date);
    const originalCheckOut = parseISO(reservation.check_out_date);
    const duration = Math.ceil((originalCheckOut.getTime() - originalCheckIn.getTime()) / (1000 * 60 * 60 * 24));

    // New dates based on drop position
    const newCheckIn = format(date, "yyyy-MM-dd");
    const newCheckOut = format(addDays(date, duration), "yyyy-MM-dd");

    // Check if anything changed
    const siteChanged = siteId !== reservation.site_id;
    const datesChanged = newCheckIn !== reservation.check_in_date;
    const siteTypeChanged = originalSite.site_type_id !== newSite.site_type_id;

    if (!siteChanged && !datesChanged) {
      // No change, just reset
      setDraggingReservation(null);
      setDropTarget(null);
      return;
    }

    // Check for conflicts with existing reservations
    const hasConflict = reservations.some(res => {
      if (res.id === reservation.id) return false;
      if (res.site_id !== siteId) return false;
      
      const resCheckIn = parseISO(res.check_in_date);
      const resCheckOut = parseISO(res.check_out_date);
      const newCheckInDate = parseISO(newCheckIn);
      const newCheckOutDate = parseISO(newCheckOut);
      
      // Check for overlap
      return newCheckInDate < resCheckOut && newCheckOutDate > resCheckIn;
    });

    if (hasConflict) {
      toast.error("Cannot move reservation - conflicts with existing booking");
      setDraggingReservation(null);
      setDropTarget(null);
      return;
    }

    // Only auto-save if ONLY the site changed (same site type, same dates)
    // Any date change or site type change requires rate recalculation via booking form
    if (siteChanged && !siteTypeChanged && !datesChanged) {
      // Only site changed but same site type and same dates - auto-save
      await moveReservation(reservation.id, siteId, newCheckIn, newCheckOut);
    } else {
      // Site type changed OR dates changed - navigate to booking form for rate recalculation
      const params = new URLSearchParams({
        edit_reservation: reservation.id,
        site_id: siteId,
        check_in: newCheckIn,
        check_out: newCheckOut,
      });
      navigate(`/book?${params.toString()}`);
    }

    setDraggingReservation(null);
    setDropTarget(null);
  };

  const moveReservation = async (reservationId: string, newSiteId: string, newCheckIn: string, newCheckOut: string) => {
    const { error } = await supabase
      .from("reservations")
      .update({
        site_id: newSiteId,
        check_in_date: newCheckIn,
        check_out_date: newCheckOut,
      })
      .eq("id", reservationId);

    if (error) {
      toast.error("Failed to move reservation");
    } else {
      toast.success("Reservation moved successfully");
      loadData();
    }
  };


  const getSiteName = (siteId: string): string => {
    const site = sites.find((s) => s.id === siteId);
    return site ? `${site.site_number} (${site.site_type_name})` : "Unknown";
  };

  const dates = getDates();

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Booking Chart</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handlePrev10}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Prev 10
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {format(startDate, "MMM d, yyyy")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={handleDateSelect}
                  initialFocus
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
            <Button variant="outline" size="sm" onClick={handleNext10}>
              Next 10
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
            <div className="flex items-center gap-2 ml-4 border-l pl-4">
              <Button 
                variant={viewBySiteType ? "default" : "outline"} 
                size="sm"
                onClick={() => setViewBySiteType(!viewBySiteType)}
              >
                <LayoutGrid className="h-4 w-4 mr-1" />
                By {terminology.siteType}
              </Button>
            </div>
            <div className="flex items-center gap-2 ml-2">
              <Checkbox 
                id="showRates" 
                checked={showRates} 
                onCheckedChange={(checked) => setShowRates(checked === true)}
              />
              <Label htmlFor="showRates" className="text-sm cursor-pointer">Show Rates</Label>
              {showRates && chartRates.length > 0 && (
                <Select value={selectedChartRateId} onValueChange={setSelectedChartRateId}>
                  <SelectTrigger className="h-8 w-[180px]">
                    <SelectValue placeholder="Select rate" />
                  </SelectTrigger>
                  <SelectContent>
                    {chartRates.map(r => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.rate_code}{r.description ? ` — ${r.description}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {showRates && chartRates.length === 0 && (
                <span className="text-xs text-muted-foreground ml-1">
                  Enable "Show on Booking Chart" on a rate to choose
                </span>
              )}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        ) : viewBySiteType ? (
          /* Site Type Availability View */
          <div 
            className="overflow-x-auto border rounded-lg bg-card"
            onMouseUp={handleTypeCellMouseUp}
            onMouseLeave={() => {
              if (isTypeDragging) {
                resetTypeDrag();
              }
            }}
          >
            <table className="w-full border-collapse select-none">
              <thead>
                <tr className="bg-muted/50">
                  <th className="border-r px-3 py-2 text-left text-sm font-medium w-40 sticky left-0 bg-muted/50 z-10">
                    {terminology.siteType}
                  </th>
                  <th className="border-r px-3 py-2 text-center text-sm font-medium w-16 sticky left-40 bg-muted/50 z-10">
                    Total
                  </th>
                  {dates.map((date) => {
                    const occupancy = getOccupancyPercentage(date);
                    return (
                      <th
                        key={date.toISOString()}
                        className={cn(
                          "px-1 py-2 text-center text-xs font-medium min-w-[70px] border-r",
                          isSameDay(date, new Date()) && "bg-primary/10"
                        )}
                      >
                        <div>{format(date, "EEE")}</div>
                        <div>{format(date, "M/d")}</div>
                        <div className={cn("text-[10px] font-semibold", getOccupancyColor(occupancy))}>
                          {occupancy}%
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {siteTypes.map((siteType) => (
                  <tr key={siteType.id} className="border-t hover:bg-muted/20">
                    <td className="border-r px-3 py-2 text-sm font-medium sticky left-0 bg-card z-10">
                      <div className="flex items-center gap-1">
                        {siteType.name}
                        {siteType.siteCount === 0 && hasGroupBlockAllocations(siteType.id) && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger>
                                <AlertTriangle className="h-4 w-4 text-orange-500" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Group block allocated but no rooms configured for this type</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    </td>
                    <td className={cn(
                      "border-r px-3 py-2 text-sm text-center sticky left-40 bg-card z-10",
                      siteType.siteCount === 0 && hasGroupBlockAllocations(siteType.id) && "text-orange-500 font-semibold"
                    )}>
                      {siteType.siteCount}
                    </td>
                    {dates.map((date) => {
                      const available = getAvailabilityBySiteType(siteType.id, date);
                      const rate = getRateForDate(siteType.id, date);
                      return (
                        <td
                          key={date.toISOString()}
                          className={cn(
                            "border-r p-0 relative text-center",
                            showRates ? "h-14" : "h-10",
                            isSameDay(date, new Date()) && "bg-primary/5",
                            isTypeCellInSelection(siteType.id, date) && "bg-primary/20",
                            terminology.isTypeFloating && "cursor-pointer hover:bg-muted/40"
                          )}
                          onMouseDown={() => handleTypeCellMouseDown(siteType.id, date)}
                          onMouseEnter={() => handleTypeCellMouseEnter(siteType.id, date)}
                          onDoubleClick={() => handleTypeCellDoubleClick(siteType.id, date)}
                        >
                          <div className="flex flex-col items-center justify-center h-full">
                            <span className={cn(
                              "text-sm font-medium",
                              available === 0 && "text-red-600 dark:text-red-400",
                              available < 0 && "text-orange-600 dark:text-orange-400",
                              available > 0 && "text-green-600 dark:text-green-400"
                            )}>
                              {available}
                            </span>
                            {showRates && (
                              <span className="text-xs text-muted-foreground">
                                ${rate?.toFixed(0) || '—'}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {/* Total Available Row */}
                <tr className="border-t-2 border-primary/30 bg-muted/30 font-semibold">
                  <td className="border-r px-3 py-2 text-sm font-bold sticky left-0 bg-muted/30 z-10">
                    Total Available
                  </td>
                  <td className="border-r px-3 py-2 text-sm text-center sticky left-40 bg-muted/30 z-10">
                    {sites.length}
                  </td>
                  {dates.map((date) => {
                    const totalAvailable = getTotalAvailability(date);
                    return (
                      <td
                        key={date.toISOString()}
                        className={cn(
                          "border-r p-0 h-10 relative text-center",
                          isSameDay(date, new Date()) && "bg-primary/5"
                        )}
                      >
                        <div className="flex items-center justify-center h-full gap-1">
                          {totalAvailable === 0 ? (
                            <div className="flex items-center gap-1 text-red-600 dark:text-red-400">
                              <Ban className="h-4 w-4" />
                              <span className="text-xs font-bold">SOLD OUT</span>
                            </div>
                          ) : totalAvailable < 0 ? (
                            <div className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                              <AlertTriangle className="h-4 w-4" />
                              <span className="text-sm font-bold">{totalAvailable}</span>
                            </div>
                          ) : (
                            <span className={cn(
                              "text-sm font-bold",
                              "text-green-600 dark:text-green-400"
                            )}>
                              {totalAvailable}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          /* Standard Site View */
          <div 
            className="overflow-x-auto border rounded-lg bg-card"
            onMouseUp={handleCellMouseUp}
            onMouseLeave={() => {
              if (isDragging) {
                setIsDragging(false);
                setDragStart(null);
                setDragEnd(null);
              }
            }}
          >
            <table className="w-full border-collapse select-none">
              <thead>
                <tr className="bg-muted/50">
                  <th className="border-r px-3 py-2 text-left text-sm font-medium w-20 sticky left-0 bg-muted/50 z-10">
                    {terminology.site}
                  </th>
                  <th className="border-r px-3 py-2 text-left text-sm font-medium w-32 sticky left-20 bg-muted/50 z-10">
                    Type
                  </th>
                  {dates.map((date) => {
                    const occupancy = getOccupancyPercentage(date);
                    return (
                      <th
                        key={date.toISOString()}
                        className={cn(
                          "px-1 py-2 text-center text-xs font-medium min-w-[70px] border-r",
                          isSameDay(date, new Date()) && "bg-primary/10"
                        )}
                      >
                        <div>{format(date, "EEE")}</div>
                        <div>{format(date, "M/d")}</div>
                        <div className={cn("text-[10px] font-semibold", getOccupancyColor(occupancy))}>
                          {occupancy}%
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sites.map((site) => {
                  // Get combined status matching HousekeepingDashboard
                  const getCombinedStatus = () => {
                    if (site.housekeeping_status === "out_of_order") return "out_of_order";
                    if (site.occupancy_status === "vacant" && site.housekeeping_status === "clean") return "vacant_clean";
                    if (site.occupancy_status === "vacant" && site.housekeeping_status === "dirty") return "vacant_dirty";
                    if (site.occupancy_status === "occupied" && site.housekeeping_status === "clean") return "occupied_clean";
                    if (site.occupancy_status === "occupied" && site.housekeeping_status === "dirty") return "occupied_dirty";
                    // Default fallback
                    if (site.occupancy_status === "vacant") return "vacant_dirty";
                    return "occupied_dirty";
                  };

                  const combinedStatus = getCombinedStatus();

                  const getHousekeepingStatusColor = () => {
                    switch (combinedStatus) {
                      case 'vacant_clean':
                        return 'text-green-500';
                      case 'vacant_dirty':
                        return 'text-yellow-500';
                      case 'occupied_clean':
                        return 'text-purple-500';
                      case 'occupied_dirty':
                        return 'text-orange-500';
                      case 'out_of_order':
                        return 'text-red-500';
                      default:
                        return 'text-muted-foreground/30';
                    }
                  };

                  const getHousekeepingStatusTitle = () => {
                    switch (combinedStatus) {
                      case 'vacant_clean':
                        return 'Vacant Clean';
                      case 'vacant_dirty':
                        return 'Vacant Dirty';
                      case 'occupied_clean':
                        return 'Occupied Clean';
                      case 'occupied_dirty':
                        return 'Occupied Dirty';
                      case 'out_of_order':
                        return 'Out of Order';
                      default:
                        return 'Unknown';
                    }
                  };

                  return (
                  <tr key={site.id} className="border-t hover:bg-muted/20">
                    <td className="border-r px-3 py-1 text-sm font-medium sticky left-0 bg-card z-10">
                      <div className="flex items-center gap-1.5">
                        {terminology.isHotel && (
                          <TooltipProvider delayDuration={0}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Circle 
                                  className={cn("h-3 w-3 fill-current shrink-0", getHousekeepingStatusColor())}
                                />
                              </TooltipTrigger>
                              <TooltipContent side="right" className="text-xs">
                                {getHousekeepingStatusTitle()}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {site.site_number}
                      </div>
                    </td>
                    <td className="border-r px-3 py-1 text-sm text-muted-foreground sticky left-20 bg-card z-10">
                      {site.site_type_name}
                    </td>
                    {dates.map((date, dateIndex) => {
                      const reservation = getReservationForCell(site.id, date);
                      const groupBlock = !reservation ? getGroupBlockForCell(site.id, date) : undefined;
                      const isStart = reservation && isReservationStart(site.id, date);
                      const isSelected = isCellInSelection(site.id, date);
                      const hasReservation = !!reservation;
                      const hasGroupBlock = !!groupBlock;

                        const isDropTarget = dropTarget?.siteId === site.id && isSameDay(dropTarget.date, date);

                        return (
                          <td
                            key={date.toISOString()}
                            className={cn(
                              "border-r p-0 h-[34px] relative",
                              isSameDay(date, new Date()) && "bg-primary/5",
                              isSelected && "bg-primary/20",
                              isDropTarget && "bg-green-200/50",
                              !hasReservation && !hasGroupBlock && "cursor-pointer hover:bg-muted/40"
                            )}
                            onMouseDown={() => !hasGroupBlock && handleCellMouseDown(site.id, date)}
                            onMouseEnter={() => handleCellMouseEnter(site.id, date)}
                            onDoubleClick={() => !hasGroupBlock && handleCellDoubleClick(site.id, date)}
                            onDragOver={(e) => !hasGroupBlock && handleCellDragOver(e, site.id, date)}
                            onDragLeave={handleCellDragLeave}
                            onDrop={(e) => !hasGroupBlock && handleCellDrop(e, site.id, date)}
                          >
                            {reservation && isReservationVisibleStart(reservation, date) && (() => {
                              const isCheckedIn = reservation.status === 'CHECKED_IN';
                              return (
                                <div
                                  draggable={!isCheckedIn}
                                  onDragStart={(e) => {
                                    if (isCheckedIn) {
                                      e.preventDefault();
                                      toast.info(`${terminology.site} moves for checked-in guests must be done through the folio`, {
                                        description: "Click the reservation to open details, then use View Folio → Edit"
                                      });
                                    } else {
                                      handleReservationDragStart(e, reservation);
                                    }
                                  }}
                                  onDragEnd={handleReservationDragEnd}
                                  className={cn(
                                    "absolute top-[1px] left-0 h-8 rounded px-2 flex items-center text-xs text-white font-medium truncate z-20 hover:opacity-90",
                                    getStatusColor(reservation.status),
                                    draggingReservation?.id === reservation.id && "opacity-50",
                                    isCheckedIn ? "cursor-pointer" : "cursor-grab"
                                  )}
                                  style={{
                                    width: `calc(${getReservationSpan(reservation, date) * 100}% - 2px)`,
                                    minWidth: "68px",
                                  }}
                                  title={isCheckedIn 
                                    ? `${reservation.guest_name} (Checked In) - Click to view, open folio to move ${terminology.site.toLowerCase()}`
                                    : `${reservation.guest_name} (${reservation.status}) - Drag to move`
                                  }
                                  onClick={(e) => handleReservationClick(e, reservation)}
                                >
                                  {reservation.guest_name}
                                </div>
                              );
                            })()}
                            {/* Render group block if this specific room is blocked */}
                            {groupBlock && isGroupBlockVisibleStart(groupBlock, date) && (
                              <div
                                className="absolute top-[1px] left-0 h-8 rounded px-2 flex items-center text-xs text-white font-medium truncate z-20 cursor-pointer hover:opacity-90 bg-slate-600 dark:bg-slate-500"
                                style={{
                                  width: `calc(${getGroupBlockSpan(groupBlock, date) * 100}% - 2px)`,
                                  minWidth: "68px",
                                }}
                                title={`Group Block: ${groupBlock.group_code}${groupBlock.group_description ? ` - ${groupBlock.group_description}` : ''}\nClick to view group details`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Navigate directly to booking with group block and room pre-selected
                                  const params = new URLSearchParams({
                                    groupBlockId: groupBlock.group_block_id,
                                    site: site.id,
                                    check_in: format(date, "yyyy-MM-dd"),
                                  });
                                  navigate(`/book?${params.toString()}`);
                                }}
                              >
                                {groupBlock.group_code}{groupBlock.group_description ? ` - ${groupBlock.group_description.substring(0, 12)}${groupBlock.group_description.length > 12 ? '...' : ''}` : ''}
                              </div>
                            )}
                            {!hasReservation && !hasGroupBlock && showRates && (() => {
                              const rate = getRateForDate(site.site_type_id, date);
                              const baseRate = siteTypeRates[site.site_type_id];
                              const hasSeasonalAdjustment = rate && baseRate && rate !== baseRate;
                              return rate ? (
                                <div className={cn(
                                  "absolute inset-0 flex items-center justify-center text-xs",
                                  hasSeasonalAdjustment ? "text-amber-600 font-medium" : "text-muted-foreground"
                                )}>
                                  ${rate.toFixed(0)}
                                </div>
                              ) : null;
                            })()}
                          </td>
                        );
                    })}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!viewBySiteType && (
          <div className="flex items-center justify-end gap-4 text-xs flex-wrap">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-emerald-600 dark:bg-emerald-500" />
              <span className="text-muted-foreground whitespace-nowrap">Checked In</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-blue-500 dark:bg-blue-400" />
              <span className="text-muted-foreground whitespace-nowrap">Confirmed</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-amber-500 dark:bg-amber-400" />
              <span className="text-muted-foreground whitespace-nowrap">Pending</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded bg-slate-600 dark:bg-slate-500" />
              <span className="text-muted-foreground whitespace-nowrap">Group Block</span>
            </div>
          </div>
        )}

        {/* Active Group Blocks Panel - Only shown when viewing by site type */}
        {viewBySiteType && visibleGroupBlocks.length > 0 && (
          <Collapsible defaultOpen className="mt-4">
            <Card>
              <CardHeader className="py-3 px-4">
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between cursor-pointer">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Active Group Blocks ({visibleGroupBlocks.length})
                    </CardTitle>
                    <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 data-[state=open]:rotate-180" />
                  </div>
                </CollapsibleTrigger>
              </CardHeader>
              <CollapsibleContent>
                <CardContent className="pt-0 pb-3 px-4 space-y-2">
                  {visibleGroupBlocks.map((group) => (
                    <div
                      key={group.id}
                      className="flex items-center justify-between gap-4 p-2 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <span className="font-semibold text-sm">{group.code}</span>
                        {group.description && (
                          <span className="text-sm text-muted-foreground truncate">
                            — {group.description}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground whitespace-nowrap ml-auto">
                          {formatLocalDate(group.startDate, "MMM d")} – {formatLocalDate(group.endDate, "MMM d, yyyy")}
                        </span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/group-blocks/${group.id}`)}
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1" />
                        View
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        )}
      </div>

      {/* Reservation Detail Dialog */}
      <Dialog open={!!selectedReservation} onOpenChange={(open) => !open && setSelectedReservation(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reservation Details</DialogTitle>
          </DialogHeader>
          {selectedReservation && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Guest</Label>
                  <p className="font-medium">{selectedReservation.guest_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Site</Label>
                  <p className="font-medium">{getSiteName(selectedReservation.site_id)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Check In</Label>
                  <p className="font-medium">{formatLocalDate(selectedReservation.check_in_date, "MMM d, yyyy")}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Check Out</Label>
                  <p className="font-medium">{formatLocalDate(selectedReservation.check_out_date, "MMM d, yyyy")}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p className="font-medium">{selectedReservation.guest_email || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Phone</Label>
                  <p className="font-medium">{selectedReservation.guest_phone || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Guests</Label>
                  <p className="font-medium">{selectedReservation.guests_count}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Total</Label>
                  <p className="font-medium">${selectedReservation.total_price.toFixed(2)}</p>
                </div>
                <div className="col-span-2">
                  <Label className="text-muted-foreground">Status</Label>
                  <p className="font-medium">{selectedReservation.status}</p>
                </div>
              </div>

              {selectedReservation.special_requests && (
                <div>
                  <Label className="text-muted-foreground">Special Requests</Label>
                  <p className="text-sm">{selectedReservation.special_requests}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setSelectedReservation(null)}>
              Close
            </Button>
            {selectedReservation && selectedReservation.status === "CHECKED_IN" ? (
              <>
                <Button variant="secondary" onClick={handleOpenChargeDialog}>
                  <Plus className="h-4 w-4 mr-1" />
                  Post Charge
                </Button>
                <Button onClick={handleViewFolio}>
                  View Folio
                </Button>
              </>
            ) : (
              <>
                <Button variant="secondary" onClick={handleEditReservation}>
                  Edit Reservation
                </Button>
                {selectedReservation && isArrivingToday(selectedReservation) && (
                  <Button onClick={handleCheckInReservation}>
                    Proceed to Check-In
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Charge Dialog */}
      <Dialog open={isChargeDialogOpen} onOpenChange={setIsChargeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Post Quick Charge</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Posting charge to: <span className="font-medium text-foreground">{selectedReservation?.guest_name}</span>
            </div>
            <div>
              <Label>Account</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {chargeAccounts.map((account: any) => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.code} - {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={chargeAmount}
                onChange={(e) => setChargeAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                placeholder="Charge description"
                value={chargeDescription}
                onChange={(e) => setChargeDescription(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsChargeDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePostQuickCharge} disabled={isPostingCharge}>
              {isPostingCharge ? "Posting..." : "Post Charge"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
}
