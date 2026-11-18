import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subDays, differenceInDays, addDays } from "date-fns";
import { formatLocalDate, parseLocalDate as parseLocalDateUtil } from "@/lib/dateUtils";
import {
  Moon,
  Sun,
  CheckCircle,
  Clock,
  AlertCircle,
  Play,
  FileText,
  Settings,
  RefreshCw,
  AlertTriangle,
  DollarSign,
  UserX,
  Bot,
  Wand2,
  ListChecks,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getRevenueAccountTaxes,
  calculateTaxes,
  getTotalTaxAmount,
  TaxConfig,
} from "@/lib/taxCalculations";
import { useAuditDate } from "@/contexts/AuditDateContext";
import { useProperty } from "@/contexts/PropertyContext";
import { usePropertyTerminology } from "@/hooks/usePropertyTerminology";
import { TrialBalance } from "@/components/accounting/TrialBalance";
import { CancellationBalanceDialog } from "@/components/CancellationBalanceDialog";

interface NightAudit {
  id: string;
  audit_date: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  total_room_revenue: number;
  total_tax_revenue: number;
  total_payments: number;
  folios_processed: number;
}

interface DayendClose {
  id: string;
  close_date: string;
  status: string;
  closed_at: string | null;
  closed_by_name: string | null;
  total_revenue: number;
  total_taxes: number;
  total_payments: number;
  total_refunds: number;
  account_summary: any;
  ledger_summary: any;
  exceptions_handled?: number | null;
  ai_summary?: string | null;
}

interface DayendException {
  id: string;
  close_date: string;
  exception_type: string;
  action_taken: string;
  status_before: string | null;
  status_after: string | null;
  amount_posted: number;
  confirmation_number: string | null;
  guest_name: string | null;
  site_number: string | null;
  resolution: string;
  deposit_amount?: number | null;
  deposit_disposition?: string | null;
  performed_by_name: string | null;
  details: any;
  created_at: string;
}

const ARRIVAL_ACTION_LABELS: Record<string, string> = {
  auto_cancel: "Auto-cancel reservation",
  move_next_day: "Move arrival to next day (keep departure)",
  auto_no_show: "No-show into hold folio + charge 1st night",
  stop: "Stop the audit",
  error: "Error - not resolved",
};

const DEPOSIT_ACTION_LABELS: Record<string, string> = {
  forfeit: "Forfeit to revenue",
  hold_review: "Hold for review",
  stop: "Stop the audit",
};

const DEPARTURE_ACTION_LABELS: Record<string, string> = {
  extend_stay: "Extend stay 1 night (charges post normally)",
  checkout_hold: "Check out to Check-Out Hold folio (no posting)",
  stop: "Stop the audit",
  error: "Error - not resolved",
};

interface InHouseGuest {
  id: string;
  balance: number;
  reservations: {
    check_in_date: string;
    check_out_date: string;
    total_price: number;
    status: string;
    sites: {
      site_number: string;
    };
    guests: {
      first_name: string;
      last_name: string;
    };
    rates?: {
      rate_code: string;
      revenue_account_id: string | null;
    };
  };
}

interface PendingArrival {
  id: string;
  guest_name: string;
  site_number: string;
  check_in_date: string;
  deposit_balance: number;
  deposit_account_id: string | null;
}

interface NoShowDialogState {
  open: boolean;
  reservationId: string;
  guestName: string;
  depositBalance: number;
  depositAccountId: string;
}

const DayendClosePage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");
  
  const [currentAudit, setCurrentAudit] = useState<NightAudit | null>(null);
  const [recentAudits, setRecentAudits] = useState<NightAudit[]>([]);
  const [recentCloses, setRecentCloses] = useState<DayendClose[]>([]);
  const [inHouseGuests, setInHouseGuests] = useState<InHouseGuest[]>([]);
  const [pendingArrivals, setPendingArrivals] = useState<PendingArrival[]>([]);
  const [pendingDueOuts, setPendingDueOuts] = useState<any[]>([]);
  const [checkedOutWithBalance, setCheckedOutWithBalance] = useState<any[]>([]);

  // QuickBooks integration state
  const [qbConnected, setQbConnected] = useState(false);
  const [qbAutoPost, setQbAutoPost] = useState(false);
  const [qbSyncMap, setQbSyncMap] = useState<Record<string, { status: string; external_ref: string | null }>>({});
  const [qbPostingId, setQbPostingId] = useState<string | null>(null);

  
  // Settings
  const [autoRunEnabled, setAutoRunEnabled] = useState(false);
  const [autoRunTime, setAutoRunTime] = useState("02:00");
  const [autoAdvanceAuditDate, setAutoAdvanceAuditDate] = useState(true);
  const [arrivalsAction, setArrivalsAction] = useState<string>("stop");
  const [departuresAction, setDeparturesAction] = useState<string>("stop");
  const [depositAction, setDepositAction] = useState<string>("hold_review");
  const [aiSummaryEnabled, setAiSummaryEnabled] = useState(true);

  // Exceptions
  const [exceptions, setExceptions] = useState<DayendException[]>([]);
  const [applyingPolicy, setApplyingPolicy] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // Report dialog
  const [selectedReport, setSelectedReport] = useState<DayendClose | null>(null);
  
  // Future date warning dialog
  const [showFutureDateWarning, setShowFutureDateWarning] = useState(false);

  // No-show dialog state
  const [noShowDialog, setNoShowDialog] = useState<NoShowDialogState>({
    open: false,
    reservationId: "",
    guestName: "",
    depositBalance: 0,
    depositAccountId: "",
  });

  // Use audit date from context - this is the business date
  const { auditDate, calendarDate, isAuditDateBehind, daysBehind, advanceAuditDate, refreshAuditDate } = useAuditDate();
  const { selectedProperty } = useProperty();
  const terminology = usePropertyTerminology();
  
  // Dynamic terminology for hotels vs campgrounds
  const guestLabel = terminology.isHotel ? "in-house guests" : "in-park guests";
  const guestLabelCapitalized = terminology.isHotel ? "In-House Guests" : "In-Park Guests";

  // Use imported parseLocalDate utility for local timezone date parsing

  // Check if closing would advance audit date beyond calendar date
  const handleCloseDay = () => {
    if (auditDate && calendarDate && auditDate >= calendarDate) {
      setShowFutureDateWarning(true);
    } else {
      runDayendClose();
    }
  };

  useEffect(() => {
    if (auditDate && selectedProperty?.id) {
      loadData();
    }
  }, [auditDate, selectedProperty?.id]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      loadCurrentAudit(),
      loadRecentAudits(),
      loadRecentCloses(),
      loadInHouseGuests(),
      loadPendingArrivals(),
      loadPendingDueOuts(),
      loadCheckedOutWithBalance(),
      loadSettings(),
      loadExceptions(),
    ]);
    setLoading(false);
  };

  const loadCurrentAudit = async () => {
    if (!auditDate || !selectedProperty?.id) return;
    const { data } = await supabase
      .from("night_audits")
      .select("*")
      .eq("property_id", selectedProperty.id)
      .eq("audit_date", auditDate)
      .maybeSingle();
    
    setCurrentAudit(data);
  };

  const loadPendingArrivals = async () => {
    if (!auditDate || !selectedProperty?.id) return;
    
    // Get reservations that are CONFIRMED and due to arrive on or before the audit date (overdue arrivals block day-end)
    const { data } = await supabase
      .from("reservations")
      .select(`
        id,
        check_in_date,
        guests (first_name, last_name),
        sites (site_number)
      `)
      .eq("property_id", selectedProperty.id)
      .lte("check_in_date", auditDate)
      .eq("status", "CONFIRMED");
    
    if (data) {
      // Fetch deposit info for each reservation
      const arrivalsWithDeposits = await Promise.all(
        data.map(async (r: any) => {
          const { data: deposit } = await supabase
            .from("ledger_accounts")
            .select("id, balance")
            .eq("reservation_id", r.id)
            .eq("ledger_type", "advance_deposit")
            .eq("is_active", true)
            .maybeSingle();

          return {
            id: r.id,
            guest_name: `${r.guests?.first_name || ''} ${r.guests?.last_name || ''}`.trim(),
            site_number: r.sites?.site_number || 'Unknown',
            check_in_date: r.check_in_date,
            deposit_balance: deposit ? Math.abs(deposit.balance) : 0,
            deposit_account_id: deposit?.id || null,
          };
        })
      );
      setPendingArrivals(arrivalsWithDeposits);
    } else {
      setPendingArrivals([]);
    }
  };

  const loadPendingDueOuts = async () => {
    if (!auditDate || !selectedProperty?.id) return;
    
    // Get CHECKED_IN reservations where check_out_date is on or before audit date (overdue checkouts block day-end)
    const { data } = await supabase
      .from("reservations")
      .select(`
        id,
        check_out_date,
        guests (first_name, last_name),
        sites (site_number)
      `)
      .eq("property_id", selectedProperty.id)
      .lte("check_out_date", auditDate)
      .eq("status", "CHECKED_IN");
    
    setPendingDueOuts(data || []);
  };

  const loadCheckedOutWithBalance = async () => {
    if (!selectedProperty?.id) return;
    
    const { data } = await supabase
      .from("ledger_accounts")
      .select(`
        id,
        balance,
        reservations!ledger_accounts_reservation_id_fkey!inner(
          id, 
          status,
          guests (first_name, last_name),
          sites (site_number)
        )
      `)
      .eq("property_id", selectedProperty.id)
      .eq("ledger_type", "guest")
      .eq("is_active", true)
      .eq("reservations.status", "CHECKED_OUT")
      .neq("balance", 0);
    
    setCheckedOutWithBalance(data || []);
  };

  const handleNoShow = (arrival: PendingArrival) => {
    if (arrival.deposit_balance > 0 && arrival.deposit_account_id) {
      // Has deposit - show dialog to handle it
      setNoShowDialog({
        open: true,
        reservationId: arrival.id,
        guestName: arrival.guest_name,
        depositBalance: arrival.deposit_balance,
        depositAccountId: arrival.deposit_account_id,
      });
    } else {
      // No deposit - just mark as no-show
      markAsNoShow(arrival.id);
    }
  };

  const markAsNoShow = async (reservationId: string) => {
    const { error } = await supabase
      .from("reservations")
      .update({ status: "NO_SHOW" })
      .eq("id", reservationId);

    if (error) {
      toast.error("Failed to mark as no-show");
    } else {
      toast.success("Reservation marked as no-show");
      loadPendingArrivals();
    }
  };

  const loadRecentAudits = async () => {
    if (!selectedProperty?.id) return;
    const { data } = await supabase
      .from("night_audits")
      .select("*")
      .eq("property_id", selectedProperty.id)
      .order("audit_date", { ascending: false })
      .limit(7);
    
    setRecentAudits(data || []);
  };

  const loadRecentCloses = async () => {
    if (!selectedProperty?.id) return;
    const { data } = await supabase
      .from("dayend_closes")
      .select("*")
      .eq("property_id", selectedProperty.id)
      .order("close_date", { ascending: false })
      .limit(7);

    const closes = data || [];
    setRecentCloses(closes);

    // Load QuickBooks integration status + latest sync per close
    const [{ data: intg }, { data: prop }] = await Promise.all([
      supabase
        .from("accounting_integrations")
        .select("is_active")
        .eq("property_id", selectedProperty.id)
        .eq("provider", "quickbooks")
        .maybeSingle(),
      supabase
        .from("properties")
        .select("auto_post_to_quickbooks")
        .eq("id", selectedProperty.id)
        .maybeSingle(),
    ]);
    setQbConnected(!!intg?.is_active);
    setQbAutoPost(!!prop?.auto_post_to_quickbooks);

    if (closes.length) {
      const { data: logs } = await supabase
        .from("accounting_sync_log")
        .select("dayend_close_id, status, external_ref, synced_at")
        .eq("provider", "quickbooks")
        .eq("sync_type", "post_dayend")
        .in("dayend_close_id", closes.map((c) => c.id))
        .order("synced_at", { ascending: false });
      const map: Record<string, { status: string; external_ref: string | null }> = {};
      for (const l of logs || []) {
        if (l.dayend_close_id && !map[l.dayend_close_id]) {
          map[l.dayend_close_id] = { status: l.status, external_ref: l.external_ref };
        }
      }
      setQbSyncMap(map);
    }
  };

  const postCloseToQuickBooks = async (closeId: string) => {
    setQbPostingId(closeId);
    try {
      const { data, error } = await supabase.functions.invoke("quickbooks-sync", {
        body: {
          action: "post_dayend",
          property_id: selectedProperty?.id,
          dayend_close_id: closeId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.already_posted) {
        toast.info("Already posted to QuickBooks");
      } else {
        toast.success(`Posted to QuickBooks (JE #${data.external_ref})`);
      }
      await loadRecentCloses();
    } catch (e) {
      toast.error(`QuickBooks post failed: ${(e as Error).message}`);
    } finally {
      setQbPostingId(null);
    }
  };


  const loadInHouseGuests = async () => {
    if (!selectedProperty?.id || !auditDate) return;
    
    // Only load CHECKED_IN reservations where audit date is within stay
    const { data } = await supabase
      .from("ledger_accounts")
      .select(`
        id,
        balance,
        reservations!ledger_accounts_reservation_id_fkey!inner (
          check_in_date,
          check_out_date,
          total_price,
          status,
          sites (site_number),
          guests (first_name, last_name),
          rates (rate_code, revenue_account_id)
        )
      `)
      .eq("property_id", selectedProperty.id)
      .eq("ledger_type", "guest")
      .eq("is_active", true)
      .eq("reservations.status", "CHECKED_IN")
      .lte("reservations.check_in_date", auditDate)
      .gt("reservations.check_out_date", auditDate);
    
    setInHouseGuests(data || []);
  };

  const loadSettings = async () => {
    if (!selectedProperty?.id) return;
    const { data } = await supabase
      .from("night_audit_settings")
      .select("*")
      .eq("property_id", selectedProperty.id)
      .maybeSingle();
    
    if (data) {
      setAutoRunEnabled(data.auto_run_enabled);
      setAutoRunTime(data.auto_run_time || "02:00");
      setAutoAdvanceAuditDate(data.auto_advance_audit_date ?? true);
      setArrivalsAction(data.pending_arrivals_action || "stop");
      setDepositAction((data as any).deposit_action || "hold_review");
      setDeparturesAction(data.inhouse_departure_action || "stop");
      setAiSummaryEnabled(data.ai_summary_enabled ?? true);
    }
  };

  const loadExceptions = async () => {
    if (!selectedProperty?.id) return;
    const { data } = await supabase
      .from("dayend_exceptions")
      .select("*")
      .eq("property_id", selectedProperty.id)
      .order("created_at", { ascending: false })
      .limit(200);

    setExceptions((data as any) || []);
  };

  const applyDayendPolicy = async () => {
    if (!selectedProperty?.id || !auditDate) return;
    if (arrivalsAction === "stop" && departuresAction === "stop") {
      toast.error("Both policies are set to 'Stop the audit'. Update Day-End settings first.");
      return;
    }

    setApplyingPolicy(true);
    try {
      const { data, error } = await supabase.functions.invoke("dayend-resolve-exceptions", {
        body: {
          propertyId: selectedProperty.id,
          auditDate,
          arrivalsAction,
          departuresAction,
          depositAction,
        },
      });

      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);

      const handled = (data as any)?.handled ?? 0;
      const blockedMsg = (data as any)?.arrivals?.message || (data as any)?.departures?.message;
      if (handled > 0) {
        toast.success(`${handled} exception(s) resolved and documented`);
      } else if (blockedMsg) {
        toast.warning(blockedMsg);
      } else {
        toast.info("No exceptions to resolve");
      }
      await loadData();
    } catch (e: any) {
      console.error("Apply policy error:", e);
      toast.error(e.message || "Failed to apply day-end policy");
    } finally {
      setApplyingPolicy(false);
    }
  };

  const runNightAudit = async () => {
    if (!auditDate) return;
    
    setProcessing(true);
    setProgress(0);
    setProgressMessage("Starting night audit...");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const staffName = user?.user_metadata?.first_name 
        ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`
        : 'Staff';

      // Create or update night audit record
      let auditId = currentAudit?.id;
      
      if (!auditId) {
        if (!selectedProperty?.id) {
          toast.error("No property selected");
          setProcessing(false);
          return;
        }
        const { data: newAudit, error } = await supabase
          .from("night_audits")
          .insert({
            property_id: selectedProperty.id,
            audit_date: auditDate,
            status: "in_progress",
            started_at: new Date().toISOString(),
            started_by: user?.id,
          })
          .select()
          .single();
        
        if (error) throw error;
        auditId = newAudit.id;
      } else {
        await supabase
          .from("night_audits")
          .update({
            status: "in_progress",
            started_at: new Date().toISOString(),
            started_by: user?.id,
          })
          .eq("id", auditId);
      }

      setProgress(20);
      setProgressMessage(`Loading ${guestLabel}...`);

      // Get ONLY in-house guests: CHECKED_IN reservations where audit date is within stay
      const { data: folios } = await supabase
        .from("ledger_accounts")
        .select(`
          id,
          balance,
          reservation_id,
          reservations!ledger_accounts_reservation_id_fkey!inner (
            id,
            check_in_date,
            check_out_date,
            total_price,
            adults_count,
            status,
            sites (site_number),
            guests (first_name, last_name),
            rates (rate_code, revenue_account_id)
          )
        `)
        .eq("property_id", selectedProperty.id)
        .eq("ledger_type", "guest")
        .eq("is_active", true)
        .eq("reservations.status", "CHECKED_IN")
        .lte("reservations.check_in_date", auditDate)
        .gt("reservations.check_out_date", auditDate);

      console.log(`Night Audit: Found ${folios?.length || 0} in-house folios for ${auditDate}`);

      if (!folios || folios.length === 0) {
        toast.info(`No ${guestLabel} to process`);
        await supabase
          .from("night_audits")
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
            completed_by: user?.id,
            folios_processed: 0,
          })
          .eq("id", auditId);
        
        setProcessing(false);
        loadData();
        return;
      }

      setProgress(40);
      setProgressMessage(`Processing ${folios.length} folios...`);

      let totalRoomRevenue = 0;
      let totalTaxRevenue = 0;
      let foliosProcessed = 0;
      let skippedFolios = 0;

      // Process each folio - post nightly revenue and taxes
      for (let i = 0; i < folios.length; i++) {
        const folio = folios[i];
        const reservation = folio.reservations;
        
        if (!reservation) continue;

        // Defense in depth: Double-check the reservation is actually in-house on the audit date
        const checkIn = new Date(reservation.check_in_date);
        const checkOut = new Date(reservation.check_out_date);
        const auditDateObj = parseLocalDateUtil(auditDate);
        
        if (!auditDateObj || reservation.status !== 'CHECKED_IN' || checkIn > auditDateObj || checkOut <= auditDateObj) {
          console.log(`Skipping reservation ${reservation.id}: not in-house on ${auditDate} (status: ${reservation.status}, check_in: ${reservation.check_in_date}, check_out: ${reservation.check_out_date})`);
          skippedFolios++;
          continue;
        }

        // Calculate nightly rate
        const totalNights = Math.max(1, differenceInDays(checkOut, checkIn));
        const nightlyRate = reservation.total_price / totalNights;
        const adultsCount = reservation.adults_count || 1;

        // Get current running balance
        const { data: lastPosting } = await supabase
          .from("folio_postings")
          .select("running_balance")
          .eq("ledger_account_id", folio.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        let currentBalance = lastPosting?.running_balance || folio.balance;
        const revenueAccountId = reservation.rates?.revenue_account_id;

        // Post room revenue for tonight - use auditDate for description, not current date
        const newRoomBalance = currentBalance + nightlyRate;
        await supabase.from("folio_postings").insert({
          ledger_account_id: folio.id,
          night_audit_id: auditId,
          posting_type: "room",
          description: `Night Audit - Room Charge (${formatLocalDate(auditDate, "MM/dd/yyyy")})`,
          amount: nightlyRate,
          debit_amount: nightlyRate,
          credit_amount: 0,
          running_balance: newRoomBalance,
          posting_date: auditDate,
          posted_by: user?.id,
          posted_by_name: `Night Audit - ${staffName}`,
          account_id: revenueAccountId,
        });

        // Create ledger transaction for room charge
        await supabase.from("ledger_transactions").insert({
          ledger_account_id: folio.id,
          transaction_type: "charge",
          description: `Night Audit - Room Charge`,
          debit_amount: nightlyRate,
          credit_amount: 0,
          posted_by_name: `Night Audit - ${staffName}`,
          account_id: revenueAccountId,
          account_code: reservation.rates?.rate_code,
        });

        totalRoomRevenue += nightlyRate;
        currentBalance = newRoomBalance;

        // Calculate and post taxes if revenue account has tax configurations
        if (revenueAccountId) {
          const taxConfigs = await getRevenueAccountTaxes(revenueAccountId);
          
          if (taxConfigs.length > 0) {
            const calculatedTaxes = calculateTaxes(nightlyRate, taxConfigs, {
              numberOfDays: 1, // One night at a time
              numberOfAdults: adultsCount,
            });

            // Post each tax as a separate folio posting
            for (const tax of calculatedTaxes) {
              if (tax.calculatedAmount > 0) {
                currentBalance += tax.calculatedAmount;
                
                await supabase.from("folio_postings").insert({
                  ledger_account_id: folio.id,
                  night_audit_id: auditId,
                  posting_type: "tax",
                  description: `Night Audit - ${tax.taxAccountName} (${tax.description})`,
                  amount: tax.calculatedAmount,
                  debit_amount: tax.calculatedAmount,
                  credit_amount: 0,
                  running_balance: currentBalance,
                  posting_date: auditDate,
                  posted_by: user?.id,
                  posted_by_name: `Night Audit - ${staffName}`,
                  account_id: tax.taxAccountId,
                });

                await supabase.from("ledger_transactions").insert({
                  ledger_account_id: folio.id,
                  transaction_type: "charge",
                  description: `Night Audit - ${tax.taxAccountName}`,
                  debit_amount: tax.calculatedAmount,
                  credit_amount: 0,
                  posted_by_name: `Night Audit - ${staffName}`,
                  account_id: tax.taxAccountId,
                  account_code: tax.taxAccountCode,
                });

                totalTaxRevenue += tax.calculatedAmount;
              }
            }
          }
        }

        // Update ledger account balance
        await supabase
          .from("ledger_accounts")
          .update({ balance: currentBalance })
          .eq("id", folio.id);

        foliosProcessed++;

        setProgress(40 + Math.round((i / folios.length) * 40));
        setProgressMessage(`Processed ${i + 1} of ${folios.length} folios...`);
      }

      setProgress(80);
      setProgressMessage("Closing checked-out guest folios...");

      // Close folios for checked-out guests (move them to Guest History)
      const { data: checkedOutFolios } = await supabase
        .from("ledger_accounts")
        .select(`
          id,
          reservations!ledger_accounts_reservation_id_fkey!inner(status)
        `)
        .eq("property_id", selectedProperty.id)
        .eq("ledger_type", "guest")
        .eq("is_active", true)
        .eq("reservations.status", "CHECKED_OUT");

      let foliosClosed = 0;
      if (checkedOutFolios && checkedOutFolios.length > 0) {
        const folioIds = checkedOutFolios.map(f => f.id);
        
        await supabase
          .from("ledger_accounts")
          .update({ 
            is_active: false, 
            closed_at: new Date().toISOString() 
          })
          .in("id", folioIds);
          
        foliosClosed = checkedOutFolios.length;
      }

      setProgress(95);
      setProgressMessage("Completing night audit...");

      // Update night audit as completed
      await supabase
        .from("night_audits")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          completed_by: user?.id,
          total_room_revenue: totalRoomRevenue,
          total_tax_revenue: totalTaxRevenue,
          folios_processed: foliosProcessed,
        })
        .eq("id", auditId);

      setProgress(100);
      setProgressMessage("Night audit complete!");
      
      let successMessage = `Night audit completed. Processed ${foliosProcessed} folios. Room: $${totalRoomRevenue.toFixed(2)}, Tax: $${totalTaxRevenue.toFixed(2)}`;
      if (skippedFolios > 0) {
        successMessage += ` Skipped ${skippedFolios} non-in-house folio${skippedFolios > 1 ? 's' : ''}.`;
        console.warn(`Night Audit skipped ${skippedFolios} folios that were not in-house on ${auditDate}`);
      }
      if (foliosClosed > 0) {
        successMessage += ` Closed ${foliosClosed} checked-out folio${foliosClosed > 1 ? 's' : ''}.`;
      }
      toast.success(successMessage);
      
      loadData();
    } catch (error) {
      console.error("Night audit error:", error);
      toast.error("Night audit failed");
    } finally {
      setProcessing(false);
    }
  };

  const runDayendClose = async () => {
    if (!currentAudit || currentAudit.status !== "completed") {
      toast.error("Please complete night audit before closing the day");
      return;
    }

    // Check for pending arrivals
    if (pendingArrivals.length > 0) {
      toast.error(`Cannot close day: ${pendingArrivals.length} pending arrival(s). Check in, cancel, or reschedule these reservations first.`);
      return;
    }

    // Check for pending due-outs
    if (pendingDueOuts.length > 0) {
      toast.error(`Cannot close day: ${pendingDueOuts.length} guest(s) due to check out today but still checked in. Check them out first.`);
      return;
    }

    // Check for checked-out folios with balances
    if (checkedOutWithBalance.length > 0) {
      toast.error(`Cannot close day: ${checkedOutWithBalance.length} checked-out guest(s) have outstanding folio balances. Settle balances first.`);
      return;
    }

    if (!auditDate) return;

    setProcessing(true);
    setProgressMessage("Running day-end close...");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const staffName = user?.user_metadata?.first_name 
        ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`
        : 'Staff';

      // Calculate summary data - use audit date for filtering
      const nextDay = format(new Date(new Date(auditDate).getTime() + 86400000), "yyyy-MM-dd");
      
      // Get ledger account IDs for this property to filter folio postings
      const { data: propertyLedgerIds } = await supabase
        .from("ledger_accounts")
        .select("id")
        .eq("property_id", selectedProperty?.id);
      
      const ledgerIds = propertyLedgerIds?.map(l => l.id) || [];
      
      const { data: todayPostings } = await supabase
        .from("folio_postings")
        .select("posting_type, amount")
        .in("ledger_account_id", ledgerIds)
        .gte("posting_date", auditDate)
        .lt("posting_date", nextDay);

      const summary = {
        revenue: 0,
        taxes: 0,
        payments: 0,
        refunds: 0,
      };

      todayPostings?.forEach((p) => {
        if (p.posting_type === "revenue" || p.posting_type === "room") {
          summary.revenue += p.amount;
        } else if (p.posting_type === "tax") {
          summary.taxes += p.amount;
        } else if (p.posting_type === "payment") {
          summary.payments += Math.abs(p.amount);
        } else if (p.posting_type === "refund") {
          summary.refunds += Math.abs(p.amount);
        }
      });

      // Get ledger summary
      const { data: ledgers } = await supabase
        .from("ledger_accounts")
        .select("ledger_type, balance, is_active")
        .eq("property_id", selectedProperty?.id || '');

      const ledgerSummary = {
        guest: { count: 0, balance: 0 },
        advance_deposit: { count: 0, balance: 0 },
        city: { count: 0, balance: 0 },
      };

      ledgers?.forEach((l) => {
        if (l.is_active) {
          const type = l.ledger_type as keyof typeof ledgerSummary;
          if (ledgerSummary[type]) {
            ledgerSummary[type].count++;
            ledgerSummary[type].balance += l.balance;
          }
        }
      });

      // Create or update dayend close record
      const { data: existingClose } = await supabase
        .from("dayend_closes")
        .select("id")
        .eq("property_id", selectedProperty?.id)
        .eq("close_date", auditDate)
        .maybeSingle();

      if (existingClose) {
        await supabase
          .from("dayend_closes")
          .update({
            status: "closed",
            closed_at: new Date().toISOString(),
            closed_by: user?.id,
            closed_by_name: staffName,
            night_audit_id: currentAudit.id,
            total_revenue: summary.revenue,
            total_taxes: summary.taxes,
            total_payments: summary.payments,
            total_refunds: summary.refunds,
            ledger_summary: ledgerSummary,
          })
          .eq("id", existingClose.id);
      } else {
        await supabase
          .from("dayend_closes")
          .insert({
            property_id: selectedProperty?.id || '',
            close_date: auditDate,
            status: "closed",
            closed_at: new Date().toISOString(),
            closed_by: user?.id,
            closed_by_name: staffName,
            night_audit_id: currentAudit.id,
            total_revenue: summary.revenue,
            total_taxes: summary.taxes,
            total_payments: summary.payments,
            total_refunds: summary.refunds,
            ledger_summary: ledgerSummary,
          });
      }

      // First, sync occupancy status from checked-in reservations
      // Get all sites with CHECKED_IN reservations
      // Campground PMS: occupancy/housekeeping status are not tracked at the site level.

      // Process *Out room guests with zero balance - close their folios back to history
      const { data: outSite } = await supabase
        .from("sites")
        .select("id")
        .eq("property_id", selectedProperty?.id)
        .eq("site_number", "*Out")
        .maybeSingle();

      if (outSite?.id) {
        const { data: outGuestFolios } = await supabase
          .from("ledger_accounts")
          .select(`
            id,
            balance,
            reservation_id,
            reservations!ledger_accounts_reservation_id_fkey!inner(id, status, site_id)
          `)
          .eq("property_id", selectedProperty?.id)
          .eq("ledger_type", "guest")
          .eq("is_active", true)
          .eq("reservations.status", "CHECKED_IN")
          .eq("reservations.site_id", outSite.id)
          .eq("balance", 0);

        if (outGuestFolios && outGuestFolios.length > 0) {
          console.log(`Processing ${outGuestFolios.length} *Out room guests with zero balance`);
          
          for (const folio of outGuestFolios) {
            // Set reservation to CHECKED_OUT
            await supabase
              .from("reservations")
              .update({ status: "CHECKED_OUT" })
              .eq("id", folio.reservation_id);

            // Close the folio
            await supabase
              .from("ledger_accounts")
              .update({ 
                is_active: false, 
                closed_at: new Date().toISOString() 
              })
              .eq("id", folio.id);

            console.log(`Closed *Out folio ${folio.id} with zero balance`);
          }

          toast.info(`Closed ${outGuestFolios.length} balanced *Out folios`);
        }
      }

      // Purge change journal entries older than 45 days
      const purgeDate = new Date();
      purgeDate.setDate(purgeDate.getDate() - 45);
      await supabase
        .from("change_journal")
        .delete()
        .eq("property_id", selectedProperty?.id)
        .lt("created_at", purgeDate.toISOString());

      // Advance the audit date to the next day
      const advanced = await advanceAuditDate();
      if (advanced) {
        toast.success("Day-end close completed - Audit date advanced");
      } else {
        toast.success("Day-end close completed");
      }

      // Auto-post to QuickBooks if enabled + integration active
      try {
        const [{ data: intg }, { data: prop }] = await Promise.all([
          supabase
            .from("accounting_integrations")
            .select("is_active")
            .eq("property_id", selectedProperty?.id)
            .eq("provider", "quickbooks")
            .maybeSingle(),
          supabase
            .from("properties")
            .select("auto_post_to_quickbooks")
            .eq("id", selectedProperty?.id)
            .maybeSingle(),
        ]);
        if (intg?.is_active && prop?.auto_post_to_quickbooks) {
          const { data: closeRow } = await supabase
            .from("dayend_closes")
            .select("id")
            .eq("property_id", selectedProperty?.id)
            .eq("close_date", auditDate)
            .maybeSingle();
          if (closeRow?.id) {
            toast.info("Posting to QuickBooks...");
            const { data: r, error: rErr } = await supabase.functions.invoke("quickbooks-sync", {
              body: { action: "post_dayend", property_id: selectedProperty?.id, dayend_close_id: closeRow.id },
            });
            if (rErr || r?.error) {
              toast.error(`QuickBooks auto-post failed: ${rErr?.message ?? r?.error}`);
            } else {
              toast.success(`Posted to QuickBooks (JE #${r?.external_ref ?? "n/a"})`);
            }
          }
        }
      } catch (e) {
        console.error("QB auto-post error", e);
      }

      await refreshAuditDate();
      // loadData() is triggered automatically by useEffect when auditDate changes

    } catch (error) {
      console.error("Day-end close error:", error);
      toast.error("Day-end close failed");
    } finally {
      setProcessing(false);
    }
  };

  const saveSettings = async () => {
    if (!selectedProperty?.id) {
      toast.error("No property selected");
      return;
    }
    try {
      const { data: existing } = await supabase
        .from("night_audit_settings")
        .select("id")
        .eq("property_id", selectedProperty.id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("night_audit_settings")
          .update({
            auto_run_enabled: autoRunEnabled,
            auto_run_time: autoRunTime,
            auto_advance_audit_date: autoAdvanceAuditDate,
            pending_arrivals_action: arrivalsAction,
            inhouse_departure_action: departuresAction,
            deposit_action: depositAction,
            ai_summary_enabled: aiSummaryEnabled,
          })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("night_audit_settings")
          .insert({
            property_id: selectedProperty.id,
            auto_run_enabled: autoRunEnabled,
            auto_run_time: autoRunTime,
            auto_advance_audit_date: autoAdvanceAuditDate,
            pending_arrivals_action: arrivalsAction,
            inhouse_departure_action: departuresAction,
            deposit_action: depositAction,
            ai_summary_enabled: aiSummaryEnabled,
          });
      }

      toast.success("Settings saved");
      setIsSettingsOpen(false);
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
      case "closed":
        return <Badge className="bg-green-500/10 text-green-700"><CheckCircle className="h-3 w-3 mr-1" /> {status}</Badge>;
      case "in_progress":
        return <Badge className="bg-blue-500/10 text-blue-700"><RefreshCw className="h-3 w-3 mr-1 animate-spin" /> In Progress</Badge>;
      case "pending":
      case "open":
        return <Badge className="bg-yellow-500/10 text-yellow-700"><Clock className="h-3 w-3 mr-1" /> {status}</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const currentClose = recentCloses.find(c => c.close_date === auditDate);

  // Format the audit date for display
  const auditDateDisplay = auditDate ? format(parseLocalDateUtil(auditDate)!, "MMMM d, yyyy") : "";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold">Day-End Close</h1>
            <p className="text-sm text-muted-foreground">Night audit and daily reporting</p>
          </div>
          <div className="flex items-center flex-wrap gap-2 sm:gap-4">
            {isAuditDateBehind && (
              <Badge variant="destructive" className="flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {daysBehind} day{daysBehind > 1 ? 's' : ''} behind
              </Badge>
            )}
            <Button variant="outline" size="sm" onClick={() => setIsSettingsOpen(true)}>
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </Button>
          </div>
        </div>

        {/* Current Audit Date Status */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Night Audit Card */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-full bg-primary/10">
                <Moon className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Night Audit</h2>
                <p className="text-sm text-muted-foreground">{auditDateDisplay}</p>
              </div>
              <div className="ml-auto">
                {currentAudit ? getStatusBadge(currentAudit.status) : <Badge variant="secondary">Not Started</Badge>}
              </div>
            </div>

            {processing && (
              <div className="space-y-2 mb-4">
                <Progress value={progress} />
                <p className="text-sm text-muted-foreground">{progressMessage}</p>
              </div>
            )}

            {currentAudit?.status === "completed" ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 rounded-lg bg-muted">
                    <p className="text-muted-foreground">Room Revenue</p>
                    <p className="text-lg font-semibold">${currentAudit.total_room_revenue?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted">
                    <p className="text-muted-foreground">Folios Processed</p>
                    <p className="text-lg font-semibold">{currentAudit.folios_processed || 0}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Completed at {format(new Date(currentAudit.completed_at || ''), "h:mm a")}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {inHouseGuests.length} {guestLabel} to process
                </p>
                <Button 
                  onClick={runNightAudit} 
                  disabled={processing}
                  className="w-full"
                >
                  <Play className="h-4 w-4 mr-2" />
                  {processing ? "Running..." : "Run Night Audit"}
                </Button>
              </div>
            )}
          </Card>

          {/* Day-End Close Card */}
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 rounded-full bg-orange-500/10">
                <Sun className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Day-End Close</h2>
                <p className="text-sm text-muted-foreground">{auditDateDisplay}</p>
              </div>
              <div className="ml-auto">
                {currentClose ? getStatusBadge(currentClose.status) : <Badge variant="secondary">Open</Badge>}
              </div>
            </div>

            {currentClose?.status === "closed" ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 rounded-lg bg-muted">
                    <p className="text-muted-foreground">Total Revenue</p>
                    <p className="text-lg font-semibold">${currentClose.total_revenue?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted">
                    <p className="text-muted-foreground">Total Payments</p>
                    <p className="text-lg font-semibold">${currentClose.total_payments?.toFixed(2) || '0.00'}</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  Closed by {currentClose.closed_by_name} at {format(new Date(currentClose.closed_at || ''), "h:mm a")}
                </p>
                <Button variant="outline" className="w-full" onClick={() => setSelectedReport(currentClose)}>
                  <FileText className="h-4 w-4 mr-2" />
                  View Report
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {pendingArrivals.length > 0 ? (
                  <>
                    <div className="p-3 rounded-lg bg-destructive/10 text-destructive">
                      <div className="flex items-start gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <p className="text-sm font-medium">{pendingArrivals.length} pending arrival{pendingArrivals.length > 1 ? 's' : ''} must be resolved</p>
                      </div>
                      <div className="space-y-2 mt-3">
                        {pendingArrivals.map((arrival) => (
                          <div key={arrival.id} className="flex items-center justify-between p-2 rounded bg-background/50">
                            <div className="text-xs">
                              <span className="font-medium">{arrival.guest_name}</span>
                              <span className="text-muted-foreground"> - {terminology.site} {arrival.site_number}</span>
                              {arrival.deposit_balance > 0 && (
                                <Badge variant="secondary" className="ml-2 text-xs">
                                  <DollarSign className="h-3 w-3 mr-0.5" />
                                  ${arrival.deposit_balance.toFixed(2)}
                                </Badge>
                              )}
                            </div>
                            <div className="flex gap-1">
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-7 text-xs"
                                onClick={() => navigate(`/check-in?reservationId=${arrival.id}`)}
                              >
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Check In
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-7 text-xs"
                                onClick={() => handleNoShow(arrival)}
                              >
                                <UserX className="h-3 w-3 mr-1" />
                                No Show
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    {arrivalsAction !== "stop" && (
                      <Button
                        variant="secondary"
                        className="w-full"
                        onClick={applyDayendPolicy}
                        disabled={applyingPolicy}
                      >
                        <Wand2 className="h-4 w-4 mr-2" />
                        {applyingPolicy ? "Applying..." : `Apply Day-End Policy: ${ARRIVAL_ACTION_LABELS[arrivalsAction]}`}
                      </Button>
                    )}
                    {arrivalsAction !== "stop" && arrivalsAction !== "move_next_day" && (
                      <p className="text-xs text-muted-foreground text-center">
                        Advance deposits: {DEPOSIT_ACTION_LABELS[depositAction]}
                      </p>
                    )}
                    <Button disabled className="w-full">Close Day</Button>
                  </>
                ) : pendingDueOuts.length > 0 ? (
                  <>
                    <div className="p-3 rounded-lg bg-orange-500/10 text-orange-700 dark:text-orange-400">
                      <div className="flex items-start gap-2 mb-2">
                        <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <p className="text-sm font-medium">{pendingDueOuts.length} guest{pendingDueOuts.length > 1 ? 's' : ''} due to check out today</p>
                      </div>
                      <div className="space-y-2 mt-3">
                        {pendingDueOuts.map((dueOut: any) => (
                          <div key={dueOut.id} className="flex items-center justify-between p-2 rounded bg-background/50">
                            <div className="text-xs">
                              <span className="font-medium">{dueOut.guests?.first_name} {dueOut.guests?.last_name}</span>
                              <span className="text-muted-foreground"> - {terminology.site} {dueOut.sites?.site_number}</span>
                            </div>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-7 text-xs"
                              onClick={() => navigate(`/in-house-guests?reservationId=${dueOut.id}`)}
                            >
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Check Out
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                    {departuresAction !== "stop" && (
                      <Button
                        variant="secondary"
                        className="w-full"
                        onClick={applyDayendPolicy}
                        disabled={applyingPolicy}
                      >
                        <Wand2 className="h-4 w-4 mr-2" />
                        {applyingPolicy ? "Applying..." : `Apply Day-End Policy: ${DEPARTURE_ACTION_LABELS[departuresAction]}`}
                      </Button>
                    )}
                    <Button disabled className="w-full">Close Day</Button>
                  </>
                ) : checkedOutWithBalance.length > 0 ? (
                  <>
                    <div className="p-3 rounded-lg bg-red-500/10 text-red-700 dark:text-red-400">
                      <div className="flex items-start gap-2 mb-2">
                        <DollarSign className="h-4 w-4 mt-0.5 flex-shrink-0" />
                        <p className="text-sm font-medium">{checkedOutWithBalance.length} checked-out guest{checkedOutWithBalance.length > 1 ? 's' : ''} with outstanding balance</p>
                      </div>
                      <div className="space-y-2 mt-3">
                        {checkedOutWithBalance.map((folio: any) => (
                          <div key={folio.id} className="flex items-center justify-between p-2 rounded bg-background/50">
                            <div className="text-xs">
                              <span className="font-medium">{folio.reservations?.guests?.first_name} {folio.reservations?.guests?.last_name}</span>
                              <span className="text-muted-foreground"> - {terminology.site} {folio.reservations?.sites?.site_number}</span>
                              <Badge variant="destructive" className="ml-2 text-xs">
                                ${Math.abs(folio.balance).toFixed(2)}
                              </Badge>
                            </div>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-7 text-xs"
                              onClick={() => navigate(`/reservation/edit?id=${folio.reservations?.id}`)}
                            >
                              <FileText className="h-3 w-3 mr-1" />
                              View Folio
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Button disabled className="w-full">Close Day</Button>
                  </>
                ) : !currentAudit || currentAudit.status !== "completed" ? (
                  <>
                    <div className="p-3 rounded-lg bg-yellow-500/10 text-yellow-700 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      <span className="text-sm">Complete night audit first</span>
                    </div>
                    <Button disabled className="w-full">Close Day</Button>
                  </>
                ) : (
                  <Button onClick={handleCloseDay} disabled={processing} className="w-full">
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Close Day
                  </Button>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Recent History */}
        <Tabs defaultValue="trial-balance">
          <TabsList className="w-full flex overflow-x-auto sm:inline-flex sm:w-auto">
            <TabsTrigger value="trial-balance">Trial Balance</TabsTrigger>
            <TabsTrigger value="audits">Night Audit History</TabsTrigger>
            <TabsTrigger value="closes">Day-End Close History</TabsTrigger>
            <TabsTrigger value="exceptions">Exceptions</TabsTrigger>
            <TabsTrigger value="guests">{guestLabelCapitalized}</TabsTrigger>
          </TabsList>


          <TabsContent value="trial-balance">
            <TrialBalance asOfDate={auditDate || undefined} />
          </TabsContent>

          <TabsContent value="audits">
            <Card className="p-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Room Revenue</TableHead>
                    <TableHead className="text-right">Tax Revenue</TableHead>
                    <TableHead className="text-right">Folios</TableHead>
                    <TableHead>Completed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentAudits.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No night audits recorded
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentAudits.map((audit) => (
                      <TableRow key={audit.id}>
                        <TableCell>{format(parseLocalDateUtil(audit.audit_date)!, "MMM d, yyyy")}</TableCell>
                        <TableCell>{getStatusBadge(audit.status)}</TableCell>
                        <TableCell className="text-right">${audit.total_room_revenue?.toFixed(2) || '0.00'}</TableCell>
                        <TableCell className="text-right">${audit.total_tax_revenue?.toFixed(2) || '0.00'}</TableCell>
                        <TableCell className="text-right">{audit.folios_processed || 0}</TableCell>
                        <TableCell>
                          {audit.completed_at ? format(new Date(audit.completed_at), "h:mm a") : '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="closes">
            <Card className="p-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Payments</TableHead>
                    <TableHead>Closed By</TableHead>
                    <TableHead>QuickBooks</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentCloses.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No day-end closes recorded
                      </TableCell>
                    </TableRow>
                  ) : (
                    recentCloses.map((close) => {
                      const qb = qbSyncMap[close.id];
                      return (
                      <TableRow key={close.id}>
                        <TableCell>{format(parseLocalDateUtil(close.close_date)!, "MMM d, yyyy")}</TableCell>
                        <TableCell>{getStatusBadge(close.status)}</TableCell>
                        <TableCell className="text-right">${close.total_revenue?.toFixed(2) || '0.00'}</TableCell>
                        <TableCell className="text-right">${close.total_payments?.toFixed(2) || '0.00'}</TableCell>
                        <TableCell>{close.closed_by_name || '-'}</TableCell>
                        <TableCell>
                          {!qbConnected ? (
                            <span className="text-xs text-muted-foreground">Not connected</span>
                          ) : qb?.status === "success" ? (
                            <Badge className="bg-emerald-600 gap-1">
                              <CheckCircle className="h-3 w-3" />
                              JE #{qb.external_ref}
                            </Badge>
                          ) : qb?.status === "failed" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs border-destructive text-destructive"
                              onClick={() => postCloseToQuickBooks(close.id)}
                              disabled={qbPostingId === close.id || close.status !== "closed"}
                            >
                              {qbPostingId === close.id ? "Posting..." : "Retry Post"}
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => postCloseToQuickBooks(close.id)}
                              disabled={qbPostingId === close.id || close.status !== "closed"}
                            >
                              {qbPostingId === close.id ? "Posting..." : "Post to QB"}
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => setSelectedReport(close)}>
                            <FileText className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                      );
                    })
                  )}
                </TableBody>

              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="exceptions">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <ListChecks className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Day-End Exception Journal</p>
                  <p className="text-xs text-muted-foreground">
                    Every reservation the day-end close handled automatically, with the status before and after.
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Guest</TableHead>
                      <TableHead>{terminology.site}</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>Status Change</TableHead>
                      <TableHead className="text-right">Posted</TableHead>
                      <TableHead className="text-right">Deposit</TableHead>
                      <TableHead>By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exceptions.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground">
                          No day-end exceptions recorded
                        </TableCell>
                      </TableRow>
                    ) : (
                      exceptions.map((ex) => (
                        <TableRow key={ex.id}>
                          <TableCell className="whitespace-nowrap">
                            {format(parseLocalDateUtil(ex.close_date)!, "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {ex.exception_type === "pending_arrival" ? "Due In" : "Due Out"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{ex.guest_name || "-"}</div>
                            <div className="text-xs text-muted-foreground">{ex.confirmation_number}</div>
                          </TableCell>
                          <TableCell>{ex.site_number || "-"}</TableCell>
                          <TableCell className="text-xs">
                            {(ex.exception_type === "pending_arrival"
                              ? ARRIVAL_ACTION_LABELS[ex.action_taken]
                              : DEPARTURE_ACTION_LABELS[ex.action_taken]) || ex.action_taken}
                            {ex.details?.reason && (
                              <div className="text-muted-foreground">{ex.details.reason}</div>
                            )}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            {ex.status_before || "-"} → {ex.status_after || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {Number(ex.amount_posted) > 0 ? `$${Number(ex.amount_posted).toFixed(2)}` : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {Number(ex.deposit_amount) > 0 ? (
                              <div>
                                <div>${Number(ex.deposit_amount).toFixed(2)}</div>
                                <div className="text-xs text-muted-foreground">
                                  {DEPOSIT_ACTION_LABELS[ex.deposit_disposition || ""] || ex.deposit_disposition}
                                </div>
                              </div>
                            ) : (
                              "-"
                            )}
                          </TableCell>
                          <TableCell className="text-xs">
                            {ex.performed_by_name || "Auto Day-End Close"}
                            <div className="text-muted-foreground">{ex.resolution}</div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="guests">
            <Card className="p-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Guest</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Check-In</TableHead>
                    <TableHead>Check-Out</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inHouseGuests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No {guestLabel}
                      </TableCell>
                    </TableRow>
                  ) : (
                    inHouseGuests.map((guest) => (
                      <TableRow key={guest.id}>
                        <TableCell>
                          {guest.reservations?.guests?.first_name} {guest.reservations?.guests?.last_name}
                        </TableCell>
                        <TableCell>{guest.reservations?.sites?.site_number}</TableCell>
                        <TableCell>{formatLocalDate(guest.reservations?.check_in_date, "MM/dd")}</TableCell>
                        <TableCell>{formatLocalDate(guest.reservations?.check_out_date, "MM/dd")}</TableCell>
                        <TableCell>{guest.reservations?.rates?.rate_code || 'Standard'}</TableCell>
                        <TableCell className={`text-right ${guest.balance > 0 ? 'text-destructive' : 'text-green-600'}`}>
                          ${Math.abs(guest.balance).toFixed(2)}{guest.balance < 0 ? ' CR' : ''}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Settings Dialog */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Night Audit & Auto Day-End Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Auto-Run Night Audit</Label>
                <p className="text-sm text-muted-foreground">Automatically run night audit at scheduled time</p>
              </div>
              <Switch checked={autoRunEnabled} onCheckedChange={setAutoRunEnabled} />
            </div>
            {autoRunEnabled && (
              <div>
                <Label>Run Time</Label>
                <Input
                  type="time"
                  value={autoRunTime}
                  onChange={(e) => setAutoRunTime(e.target.value)}
                />
              </div>
            )}

            <div className="flex items-center justify-between border-t pt-4">
              <div>
                <Label>Auto-Advance Audit Date</Label>
                <p className="text-sm text-muted-foreground">
                  Advance the business date automatically when the close completes
                </p>
              </div>
              <Switch checked={autoAdvanceAuditDate} onCheckedChange={setAutoAdvanceAuditDate} />
            </div>

            <div>
              <Label>Reservations Left to Arrive</Label>
              <p className="text-sm text-muted-foreground mb-2">
                How the close handles reservations that never checked in
              </p>
              <Select value={arrivalsAction} onValueChange={setArrivalsAction}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto_cancel">Auto-cancel (recorded as cancelled by Day-End Close)</SelectItem>
                  <SelectItem value="move_next_day">Move arrival to next day, keep original departure</SelectItem>
                  <SelectItem value="auto_no_show">
                    Auto no-show into a hold folio (no occupancy) and charge 1st night, tax + package items
                  </SelectItem>
                  <SelectItem value="stop">Stop the audit and document it</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>In-House Guests Left to Depart</Label>
              <p className="text-sm text-muted-foreground mb-2">
                How the close handles guests who were due out but are still checked in
              </p>
              <Select value={departuresAction} onValueChange={setDeparturesAction}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="extend_stay">Extend stay 1 night and post charges as normal</SelectItem>
                  <SelectItem value="checkout_hold">
                    Check out with no posting — folio stays in guest ledger as a Check-Out Hold
                  </SelectItem>
                  <SelectItem value="stop">Stop the audit and document it</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Advance Deposits on Auto-Cancel / Auto No-Show</Label>
              <p className="text-sm text-muted-foreground mb-2">
                What the close does with money already paid when it cancels or no-shows a reservation.
                Moving an arrival to the next day never touches the deposit — it carries forward.
              </p>
              <Select value={depositAction} onValueChange={setDepositAction}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hold_review">
                    Hold for review — deposit stays in the deposit ledger for the front desk
                  </SelectItem>
                  <SelectItem value="forfeit">
                    Forfeit to revenue — apply the deposit to charges, recognize the remainder
                  </SelectItem>
                  <SelectItem value="stop">
                    Stop the audit when a reservation carries a deposit
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <div>
                <Label className="flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  AI Close Summary
                </Label>
                <p className="text-sm text-muted-foreground">
                  Write a plain-English narrative of each close and what needs review
                </p>
              </div>
              <Switch checked={aiSummaryEnabled} onCheckedChange={setAiSummaryEnabled} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>Cancel</Button>
            <Button onClick={saveSettings}>Save Settings</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Dialog */}
      <Dialog open={!!selectedReport} onOpenChange={() => setSelectedReport(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Day-End Report - {selectedReport && format(new Date(selectedReport.close_date), "MMMM d, yyyy")}
            </DialogTitle>
          </DialogHeader>
          {selectedReport && (
            <div className="space-y-4">
              {selectedReport.ai_summary && (
                <Card className="p-4 bg-muted/40">
                  <div className="flex items-center gap-2 mb-2">
                    <Bot className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium">AI Close Summary</p>
                    {(selectedReport.exceptions_handled ?? 0) > 0 && (
                      <Badge variant="outline">{selectedReport.exceptions_handled} exception(s) handled</Badge>
                    )}
                  </div>
                  <p className="text-sm whitespace-pre-wrap text-muted-foreground">{selectedReport.ai_summary}</p>
                </Card>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 sm:gap-4">

                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Total Revenue</p>
                  <p className="text-2xl font-bold">${selectedReport.total_revenue?.toFixed(2) || '0.00'}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Total Taxes</p>
                  <p className="text-2xl font-bold">${selectedReport.total_taxes?.toFixed(2) || '0.00'}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Total Payments</p>
                  <p className="text-2xl font-bold">${selectedReport.total_payments?.toFixed(2) || '0.00'}</p>
                </Card>
                <Card className="p-4">
                  <p className="text-sm text-muted-foreground">Refunds</p>
                  <p className="text-2xl font-bold">${selectedReport.total_refunds?.toFixed(2) || '0.00'}</p>
                </Card>
              </div>

              {selectedReport.ledger_summary && (
                <div>
                  <h3 className="font-semibold mb-2">Ledger Balances</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ledger</TableHead>
                        <TableHead className="text-right">Active Accounts</TableHead>
                        <TableHead className="text-right">Total Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(selectedReport.ledger_summary as Record<string, { count: number; balance: number }>).map(([key, val]) => (
                        <TableRow key={key}>
                          <TableCell className="capitalize">{key.replace('_', ' ')}</TableCell>
                          <TableCell className="text-right">{val.count}</TableCell>
                          <TableCell className="text-right">${val.balance?.toFixed(2) || '0.00'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              <p className="text-sm text-muted-foreground">
                Closed by {selectedReport.closed_by_name} at {format(new Date(selectedReport.closed_at || ''), "h:mm a 'on' MMM d, yyyy")}
              </p>

              {/* Trial Balance for this day */}
              <div className="mt-4 pt-4 border-t">
                <TrialBalance asOfDate={selectedReport.close_date} compact showActions={false} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedReport(null)}>Close</Button>
            <Button onClick={() => window.print()}>Print Report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Future Date Warning Dialog */}
      <AlertDialog open={showFutureDateWarning} onOpenChange={setShowFutureDateWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Advance Audit Date Beyond Today?
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Completing this Day-End Close will advance the audit date to{" "}
                  <strong>{auditDate && format(addDays(parseLocalDateUtil(auditDate)!, 1), "MMM d, yyyy")}</strong>,
                  which is beyond today's calendar date ({calendarDate && format(parseLocalDateUtil(calendarDate)!, "MMM d, yyyy")}).
                </p>
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                  <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400">Important Considerations:</p>
                  <ul className="text-sm text-yellow-700 dark:text-yellow-400 mt-2 space-y-1 list-disc pl-4">
                    <li>New reservations for today's date will be blocked as "past dates"</li>
                    <li>Bookings from OTA integrations or channel managers for today may be rejected</li>
                    <li>This should only be done in exceptional circumstances</li>
                  </ul>
                </div>
                <p className="text-sm">Are you sure you want to proceed?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setShowFutureDateWarning(false); runDayendClose(); }}>
              Yes, Advance to Future Date
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {/* No-Show Dialog with Deposit Handling */}
      <CancellationBalanceDialog
        open={noShowDialog.open}
        onOpenChange={(open) => setNoShowDialog((prev) => ({ ...prev, open }))}
        reservationId={noShowDialog.reservationId}
        guestName={noShowDialog.guestName}
        depositBalance={noShowDialog.depositBalance}
        depositAccountId={noShowDialog.depositAccountId}
        mode="no_show"
        onComplete={loadPendingArrivals}
      />
    </DashboardLayout>
  );
};

export default DayendClosePage;