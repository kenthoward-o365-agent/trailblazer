import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Banknote, CreditCard, DollarSign, Loader2, ArrowRightLeft, RefreshCw, Search, Check, X } from "lucide-react";
import { getRevenueAccountTaxes, calculateTaxes, getTotalTaxAmount } from "@/lib/taxCalculations";
import { useProperty } from "@/contexts/PropertyContext";
import { useAuditDate } from "@/contexts/AuditDateContext";
import { format } from "date-fns";
import { formatLocalDate } from "@/lib/dateUtils";

interface Account {
  id: string;
  code: string;
  name: string;
  account_group_id: string;
  payment_type: string | null;
  account_groups?: {
    name: string;
    account_type: string;
  };
}

interface TransferTarget {
  id: string;
  confirmation_number: string;
  guest_name: string;
  check_in_date: string;
}

interface PaymentCard {
  id: string;
  card_brand: string;
  last_four_digits: string;
  cardholder_name: string;
  is_primary: boolean | null;
}

interface DepositManagementCardProps {
  reservationId: string;
  reservationStatus: string;
  totalCharges: number;
  firstNightRate: number;
  numberOfNights: number;
  numberOfAdults: number;
  revenueAccountId?: string | null;
  guestId: string;
  propertyId: string;
  onDepositChanged?: () => void;
}

const RESULTS_PER_PAGE = 10;

export function DepositManagementCard({
  reservationId,
  reservationStatus,
  totalCharges,
  firstNightRate,
  numberOfNights,
  numberOfAdults,
  revenueAccountId,
  guestId,
  propertyId,
  onDepositChanged,
}: DepositManagementCardProps) {
  const { selectedProperty } = useProperty();
  const { auditDate } = useAuditDate();
  
  // Payment dialog state
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [paymentAccounts, setPaymentAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [amountOption, setAmountOption] = useState("100");
  const [customAmount, setCustomAmount] = useState("");
  const [firstNightWithTax, setFirstNightWithTax] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  
  // Refund/Transfer dialog state
  const [isActionDialogOpen, setIsActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<"refund" | "transfer">("refund");
  const [selectedTarget, setSelectedTarget] = useState("");
  const [selectedTargetInfo, setSelectedTargetInfo] = useState<TransferTarget | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Transfer search state
  const [reservationSearch, setReservationSearch] = useState("");
  const [searchResults, setSearchResults] = useState<TransferTarget[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [totalResultCount, setTotalResultCount] = useState(0);
  const [searchOffset, setSearchOffset] = useState(0);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Shared state
  const [loading, setLoading] = useState(true);
  const [depositBalance, setDepositBalance] = useState(0);
  const [depositAccountId, setDepositAccountId] = useState<string | null>(null);
  const [paymentCards, setPaymentCards] = useState<PaymentCard[]>([]);

  useEffect(() => {
    loadData();
  }, [reservationId, revenueAccountId]);

  const loadData = async () => {
    setLoading(true);
    await Promise.all([
      loadPaymentAccounts(),
      loadPaymentCards(),
      loadExistingDeposit(),
      calculateFirstNightWithTax(),
    ]);
    setLoading(false);
  };

  const loadPaymentAccounts = async () => {
    const { data } = await supabase
      .from("accounts")
      .select(`
        id,
        code,
        name,
        account_group_id,
        payment_type,
        account_groups (name, account_type)
      `)
      .eq("property_id", propertyId)
      .eq("is_active", true)
      .not("payment_type", "is", null)
      .order("code");

    if (data) {
      // Filter to asset/liability accounts with payment_type set (actual payment tenders)
      const paymentAccountsFiltered = data.filter(
        (a) => a.account_groups?.account_type === "asset" || a.account_groups?.account_type === "liability"
      );
      setPaymentAccounts(paymentAccountsFiltered);
    }
  };

  const loadPaymentCards = async () => {
    const { data } = await supabase
      .from("payment_cards")
      .select("id, card_brand, last_four_digits, cardholder_name, is_primary")
      .eq("reservation_id", reservationId)
      .order("is_primary", { ascending: false, nullsFirst: false })
      .order("card_sequence", { ascending: true });

    if (data) {
      setPaymentCards(data);
    }
  };

  // Get the best matching account for a card brand
  const getAccountForCardBrand = (cardBrand: string): string | null => {
    if (!cardBrand || paymentAccounts.length === 0) return null;

    const normalizedBrand = cardBrand.toLowerCase().trim();

    // First try to match by payment_type field (most reliable)
    for (const account of paymentAccounts) {
      if (!account.payment_type) continue;
      const pt = account.payment_type.toLowerCase();

      // Direct matches
      if (normalizedBrand.includes("visa") && pt === "visa") return account.id;
      if (normalizedBrand.includes("mastercard") && pt === "mastercard") return account.id;
      if ((normalizedBrand.includes("american express") || normalizedBrand.includes("amex")) && pt === "amex") return account.id;
      if (normalizedBrand.includes("discover") && pt === "discover") return account.id;
    }

    // For Visa/Mastercard, also check if there's a combined account (payment_type = 'visa' often covers both)
    if (normalizedBrand.includes("mastercard")) {
      const visaAccount = paymentAccounts.find(a => a.payment_type?.toLowerCase() === "visa");
      if (visaAccount) return visaAccount.id;
    }

    // Fallback: Match by account name (for accounts without payment_type set)
    for (const account of paymentAccounts) {
      const accountName = account.name.toLowerCase();

      if (normalizedBrand.includes("visa") && (accountName.includes("visa") || accountName.includes("mc/vs") || accountName.includes("vs"))) {
        return account.id;
      }
      if (normalizedBrand.includes("mastercard") && (accountName.includes("master") || accountName.includes("mc/vs") || accountName.includes("mc"))) {
        return account.id;
      }
      if ((normalizedBrand.includes("american express") || normalizedBrand.includes("amex")) && (accountName.includes("amex") || accountName.includes("american") || accountName.includes("ax"))) {
        return account.id;
      }
      if (normalizedBrand.includes("discover") && accountName.includes("discover")) {
        return account.id;
      }
    }

    return null;
  };

  const loadExistingDeposit = async () => {
    const { data } = await supabase
      .from("ledger_accounts")
      .select("id, balance")
      .eq("reservation_id", reservationId)
      .eq("ledger_type", "advance_deposit")
      .maybeSingle();

    if (data) {
      setDepositBalance(data.balance);
      setDepositAccountId(data.id);
    } else {
      setDepositBalance(0);
      setDepositAccountId(null);
    }
  };

  const calculateFirstNightWithTax = async () => {
    if (!revenueAccountId) {
      setFirstNightWithTax(firstNightRate);
      return;
    }

    try {
      const taxConfigs = await getRevenueAccountTaxes(revenueAccountId);
      const taxes = calculateTaxes(firstNightRate, taxConfigs, {
        numberOfDays: 1,
        numberOfAdults,
      });
      const totalTax = getTotalTaxAmount(taxes);
      setFirstNightWithTax(firstNightRate + totalTax);
    } catch (error) {
      console.error("Error calculating first night tax:", error);
      setFirstNightWithTax(firstNightRate);
    }
  };

  // Open payment dialog and auto-select account based on card on file
  const openPaymentDialog = () => {
    // Try to auto-select account based on primary card on file
    const primaryCard = paymentCards.find(c => c.is_primary) || paymentCards[0];
    
    if (primaryCard) {
      const matchedAccountId = getAccountForCardBrand(primaryCard.card_brand);
      if (matchedAccountId) {
        setSelectedAccountId(matchedAccountId);
      } else if (paymentAccounts.length > 0) {
        setSelectedAccountId(paymentAccounts[0].id);
      }
    } else if (paymentAccounts.length > 0) {
      setSelectedAccountId(paymentAccounts[0].id);
    }
    
    setIsPaymentDialogOpen(true);
  };

  // Auto-select account when dialog opens and data is loaded
  useEffect(() => {
    if (isPaymentDialogOpen && paymentAccounts.length > 0 && !selectedAccountId) {
      const primaryCard = paymentCards.find(c => c.is_primary) || paymentCards[0];
      if (primaryCard) {
        const matchedAccountId = getAccountForCardBrand(primaryCard.card_brand);
        if (matchedAccountId) {
          setSelectedAccountId(matchedAccountId);
          return;
        }
      }
      // Default to first account if no card match
      setSelectedAccountId(paymentAccounts[0].id);
    }
  }, [isPaymentDialogOpen, paymentAccounts, paymentCards, selectedAccountId]);

  const searchReservations = async (searchTerm: string, offset: number = 0, append: boolean = false) => {
    if (!selectedProperty?.id || searchTerm.length < 2) {
      if (!append) {
        setSearchResults([]);
        setTotalResultCount(0);
      }
      return;
    }

    setIsSearching(true);

    try {
      // Build the search query
      const searchLower = searchTerm.toLowerCase();
      
      // First get the count
      const { count } = await supabase
        .from("reservations")
        .select("id", { count: "exact", head: true })
        .eq("property_id", selectedProperty.id)
        .neq("id", reservationId)
        .in("status", ["CONFIRMED", "PENDING"])
        .or(`confirmation_number.ilike.%${searchTerm}%`);

      // Then get the actual results with guest info
      const { data } = await supabase
        .from("reservations")
        .select(`
          id,
          confirmation_number,
          check_in_date,
          guests (first_name, last_name)
        `)
        .eq("property_id", selectedProperty.id)
        .neq("id", reservationId)
        .in("status", ["CONFIRMED", "PENDING"])
        .or(`confirmation_number.ilike.%${searchTerm}%`)
        .order("check_in_date", { ascending: true })
        .range(offset, offset + RESULTS_PER_PAGE - 1);

      // Also search by guest name separately (Supabase doesn't support OR across relations well)
      const { data: guestNameResults, count: guestNameCount } = await supabase
        .from("reservations")
        .select(`
          id,
          confirmation_number,
          check_in_date,
          guests!inner (first_name, last_name)
        `, { count: "exact" })
        .eq("property_id", selectedProperty.id)
        .neq("id", reservationId)
        .in("status", ["CONFIRMED", "PENDING"])
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%`, { referencedTable: "guests" })
        .order("check_in_date", { ascending: true })
        .range(offset, offset + RESULTS_PER_PAGE - 1);

      // Combine results and dedupe
      const allResults = [...(data || []), ...(guestNameResults || [])];
      const uniqueMap = new Map<string, any>();
      allResults.forEach(r => {
        if (!uniqueMap.has(r.id)) {
          uniqueMap.set(r.id, r);
        }
      });

      const formattedResults: TransferTarget[] = Array.from(uniqueMap.values()).map((r: any) => ({
        id: r.id,
        confirmation_number: r.confirmation_number,
        guest_name: `${r.guests?.first_name || ""} ${r.guests?.last_name || ""}`.trim(),
        check_in_date: r.check_in_date,
      }));

      // Sort by check-in date
      formattedResults.sort((a, b) => new Date(a.check_in_date).getTime() - new Date(b.check_in_date).getTime());

      // Limit to page size
      const pageResults = formattedResults.slice(0, RESULTS_PER_PAGE);

      const totalCount = Math.max(count || 0, guestNameCount || 0);
      setTotalResultCount(totalCount);

      if (append) {
        setSearchResults(prev => {
          const existingIds = new Set(prev.map(r => r.id));
          const newResults = pageResults.filter(r => !existingIds.has(r.id));
          return [...prev, ...newResults];
        });
      } else {
        setSearchResults(pageResults);
      }
    } catch (error) {
      console.error("Error searching reservations:", error);
    } finally {
      setIsSearching(false);
    }
  };

  // Debounced search effect
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }

    if (reservationSearch.length >= 2) {
      searchDebounceRef.current = setTimeout(() => {
        setSearchOffset(0);
        searchReservations(reservationSearch, 0, false);
      }, 300);
    } else {
      setSearchResults([]);
      setTotalResultCount(0);
    }

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [reservationSearch, selectedProperty?.id]);

  const handleLoadMore = () => {
    const newOffset = searchOffset + RESULTS_PER_PAGE;
    setSearchOffset(newOffset);
    searchReservations(reservationSearch, newOffset, true);
  };

  const selectReservation = (target: TransferTarget) => {
    setSelectedTarget(target.id);
    setSelectedTargetInfo(target);
  };

  const clearSelectedReservation = () => {
    setSelectedTarget("");
    setSelectedTargetInfo(null);
  };

  const getSelectedAmount = (): number => {
    switch (amountOption) {
      case "100":
        return totalCharges;
      case "50":
        return Math.round(totalCharges * 50) / 100;
      case "first_night":
        return Math.round(firstNightWithTax * 100) / 100;
      case "custom":
        return parseFloat(customAmount) || 0;
      default:
        return 0;
    }
  };

  const handlePostPayment = async () => {
    const amount = getSelectedAmount();
    
    if (amount <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    if (!selectedAccountId) {
      toast.error("Please select a payment account");
      return;
    }

    setIsSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const staffName = user?.user_metadata?.first_name
        ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ""}`
        : "Staff";

      const selectedAccount = paymentAccounts.find((a) => a.id === selectedAccountId);
      const accountDescription = selectedAccount
        ? `${selectedAccount.code} - ${selectedAccount.name}`
        : "Payment";

      // Check if advance deposit ledger exists
      let advanceLedger: any = null;
      if (depositAccountId) {
        const { data } = await supabase
          .from("ledger_accounts")
          .select("*")
          .eq("id", depositAccountId)
          .single();
        advanceLedger = data;
      }

      // Create advance deposit ledger if it doesn't exist
      if (!advanceLedger) {
        const { data: newLedger, error: createError } = await supabase
          .from("ledger_accounts")
          .insert({
            reservation_id: reservationId,
            guest_id: guestId,
            property_id: propertyId,
            ledger_type: "advance_deposit",
            balance: 0,
            is_active: true,
          })
          .select()
          .single();

        if (createError) throw createError;
        advanceLedger = newLedger;
      }

      const newBalance = advanceLedger.balance + amount;

      // Create folio posting
      const { error: postingError } = await supabase.from("folio_postings").insert({
        ledger_account_id: advanceLedger.id,
        posting_type: "payment",
        description: `Advance Deposit - ${accountDescription}`,
        amount: amount,
        running_balance: newBalance,
        posting_date: auditDate,
        posted_by: user?.id,
        posted_by_name: staffName,
        account_id: selectedAccountId,
      });

      if (postingError) throw postingError;

      // Create ledger transaction
      await supabase.from("ledger_transactions").insert({
        ledger_account_id: advanceLedger.id,
        transaction_type: "payment",
        description: `Advance Deposit Payment - ${accountDescription}`,
        debit_amount: amount,
        credit_amount: 0,
        posted_by_name: staffName,
        account_id: selectedAccountId,
        account_code: selectedAccount?.code,
      });

      // Update ledger account balance
      await supabase
        .from("ledger_accounts")
        .update({ balance: newBalance })
        .eq("id", advanceLedger.id);

      toast.success(`Advance deposit of $${amount.toFixed(2)} posted successfully`);
      
      setIsPaymentDialogOpen(false);
      setAmountOption("100");
      setCustomAmount("");
      setDepositBalance(newBalance);
      setDepositAccountId(advanceLedger.id);
      
      onDepositChanged?.();
    } catch (error) {
      console.error("Error posting advance deposit:", error);
      toast.error("Failed to post advance deposit");
    } finally {
      setIsSaving(false);
    }
  };

  const handleRefund = async () => {
    if (!depositAccountId) return;

    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const staffName = user?.user_metadata?.first_name
        ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ""}`
        : "Staff";

      const { data: lastPosting } = await supabase
        .from("folio_postings")
        .select("running_balance")
        .eq("ledger_account_id", depositAccountId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const currentBalance = lastPosting?.running_balance || depositBalance;
      const newBalance = currentBalance - depositBalance;

      // Post refund
      await supabase.from("folio_postings").insert({
        ledger_account_id: depositAccountId,
        posting_type: "refund",
        description: "Deposit refund",
        amount: depositBalance,
        debit_amount: depositBalance,
        credit_amount: 0,
        running_balance: newBalance,
        posting_date: auditDate,
        posted_by: user?.id,
        posted_by_name: staffName,
      });

      // Close the advance deposit account
      await supabase
        .from("ledger_accounts")
        .update({ is_active: false, balance: 0 })
        .eq("id", depositAccountId);

      toast.success(`Deposit of $${depositBalance.toFixed(2)} refunded`);
      setIsActionDialogOpen(false);
      setDepositBalance(0);
      onDepositChanged?.();
    } catch (error: any) {
      toast.error(`Failed to process refund: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTransfer = async () => {
    if (!selectedTarget || !depositAccountId) {
      toast.error("Please select a reservation to transfer to");
      return;
    }

    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const staffName = user?.user_metadata?.first_name
        ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ""}`
        : "Staff";

      // Get or create advance deposit account for target reservation
      let targetAccountId: string;
      const { data: existingAccount } = await supabase
        .from("ledger_accounts")
        .select("id")
        .eq("reservation_id", selectedTarget)
        .eq("ledger_type", "advance_deposit")
        .eq("is_active", true)
        .maybeSingle();

      if (existingAccount) {
        targetAccountId = existingAccount.id;
      } else {
        const { data: newAccount, error: createError } = await supabase
          .from("ledger_accounts")
          .insert({
            property_id: selectedProperty?.id,
            ledger_type: "advance_deposit",
            reservation_id: selectedTarget,
            balance: 0,
          })
          .select()
          .single();

        if (createError) throw createError;
        targetAccountId = newAccount.id;
      }

      // Post debit to source account
      const { data: sourceLastPosting } = await supabase
        .from("folio_postings")
        .select("running_balance")
        .eq("ledger_account_id", depositAccountId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const sourceBalance = sourceLastPosting?.running_balance || depositBalance;

      await supabase.from("folio_postings").insert({
        ledger_account_id: depositAccountId,
        posting_type: "transfer_out",
        description: "Transfer to another reservation",
        amount: depositBalance,
        debit_amount: depositBalance,
        credit_amount: 0,
        running_balance: sourceBalance - depositBalance,
        posting_date: auditDate,
        posted_by: user?.id,
        posted_by_name: staffName,
      });

      // Close source account
      await supabase
        .from("ledger_accounts")
        .update({ is_active: false, balance: 0 })
        .eq("id", depositAccountId);

      // Get target account balance
      const { data: targetLastPosting } = await supabase
        .from("folio_postings")
        .select("running_balance")
        .eq("ledger_account_id", targetAccountId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const targetBalance = targetLastPosting?.running_balance || 0;

      // Post credit to target account
      await supabase.from("folio_postings").insert({
        ledger_account_id: targetAccountId,
        posting_type: "transfer_in",
        description: "Transfer from another reservation",
        amount: depositBalance,
        debit_amount: 0,
        credit_amount: depositBalance,
        running_balance: targetBalance + depositBalance,
        posting_date: auditDate,
        posted_by: user?.id,
        posted_by_name: staffName,
      });

      // Update target account balance
      await supabase
        .from("ledger_accounts")
        .update({ balance: targetBalance + depositBalance })
        .eq("id", targetAccountId);

      toast.success(`Deposit of $${depositBalance.toFixed(2)} transferred`);
      setIsActionDialogOpen(false);
      setSelectedTarget("");
      setDepositBalance(0);
      onDepositChanged?.();
    } catch (error: any) {
      toast.error(`Failed to transfer deposit: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const openActionDialog = (type: "refund" | "transfer") => {
    setActionType(type);
    if (type === "transfer") {
      // Reset search state when opening transfer dialog
      setReservationSearch("");
      setSearchResults([]);
      setTotalResultCount(0);
      setSearchOffset(0);
      setSelectedTarget("");
      setSelectedTargetInfo(null);
    }
    setIsActionDialogOpen(true);
  };

  // Determine which actions are available
  const canTakePayment = reservationStatus === "PENDING" || reservationStatus === "CONFIRMED";
  const hasBalance = depositBalance > 0;

  // Group accounts dynamically by their account group name
  const accountsByGroup = paymentAccounts.reduce((groups, account) => {
    const groupName = account.account_groups?.name || "Other";
    if (!groups[groupName]) {
      groups[groupName] = [];
    }
    groups[groupName].push(account);
    return groups;
  }, {} as Record<string, Account[]>);

  if (loading) {
    return null;
  }

  return (
    <>
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-semibold">Advance Deposit</h3>
              {hasBalance ? (
                <p className="text-sm text-muted-foreground">
                  Current Balance: <span className="text-green-600 font-medium">${depositBalance.toFixed(2)}</span>
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No deposit on file</p>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {canTakePayment && (
              <Button onClick={openPaymentDialog}>
                <DollarSign className="h-4 w-4 mr-1" />
                Take Payment
              </Button>
            )}
            {hasBalance && (
              <>
                <Button variant="outline" onClick={() => openActionDialog("refund")}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Refund
                </Button>
                <Button variant="outline" onClick={() => openActionDialog("transfer")}>
                  <ArrowRightLeft className="h-4 w-4 mr-1" />
                  Transfer
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Take Payment Dialog */}
      <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Advance Deposit Payment</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <Label className="text-base font-medium">Payment Amount</Label>
              <RadioGroup value={amountOption} onValueChange={setAmountOption}>
                <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 cursor-pointer">
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="100" id="amount-100" />
                    <Label htmlFor="amount-100" className="cursor-pointer">
                      100% of Total Charges
                    </Label>
                  </div>
                  <span className="font-medium">${totalCharges.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 cursor-pointer">
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="50" id="amount-50" />
                    <Label htmlFor="amount-50" className="cursor-pointer">
                      50% of Total Charges
                    </Label>
                  </div>
                  <span className="font-medium">${(totalCharges * 0.5).toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 cursor-pointer">
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="first_night" id="amount-first" />
                    <Label htmlFor="amount-first" className="cursor-pointer">
                      First Night + Tax
                    </Label>
                  </div>
                  <span className="font-medium">${firstNightWithTax.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent/50 cursor-pointer">
                  <div className="flex items-center space-x-3">
                    <RadioGroupItem value="custom" id="amount-custom" />
                    <Label htmlFor="amount-custom" className="cursor-pointer">
                      Custom Amount
                    </Label>
                  </div>
                  {amountOption === "custom" && (
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      className="w-28 text-right"
                      onClick={(e) => e.stopPropagation()}
                    />
                  )}
                </div>
              </RadioGroup>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-medium">Payment Method</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select payment account" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(accountsByGroup).map(([groupName, accounts], index) => (
                    <div key={groupName}>
                      <div className={`px-2 py-1.5 text-sm font-semibold text-muted-foreground flex items-center gap-2 ${index > 0 ? 'mt-2' : ''}`}>
                        {groupName.toLowerCase().includes('credit') || groupName.toLowerCase().includes('card') ? (
                          <CreditCard className="h-4 w-4" />
                        ) : (
                          <Banknote className="h-4 w-4" />
                        )}
                        {groupName}
                      </div>
                      {accounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.code} - {account.name}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-lg bg-muted p-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Amount to Collect:</span>
                <span className="text-xl font-bold text-primary">
                  ${getSelectedAmount().toFixed(2)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Process payment on external terminal, then record here.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handlePostPayment} disabled={isSaving || getSelectedAmount() <= 0}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Posting...
                </>
              ) : (
                "Record Payment"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Refund/Transfer Dialog */}
      <Dialog open={isActionDialogOpen} onOpenChange={setIsActionDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {actionType === "refund" ? "Refund Deposit" : "Transfer Deposit"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {actionType === "refund" ? (
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-muted-foreground mb-2">
                  This will refund the full deposit amount and close the advance deposit account.
                </p>
                <div className="flex justify-between items-center">
                  <span className="font-medium">Refund Amount:</span>
                  <span className="text-xl font-bold text-primary">
                    ${depositBalance.toFixed(2)}
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Transfer ${depositBalance.toFixed(2)} to another reservation's advance deposit.
                </p>
                
                {/* Search Input */}
                <div className="space-y-2">
                  <Label>Search Reservation</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by confirmation #, guest name..."
                      value={reservationSearch}
                      onChange={(e) => setReservationSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                {/* Selected Reservation Display */}
                {selectedTargetInfo && (
                  <div className="flex items-center gap-2 p-3 bg-primary/10 rounded-lg border border-primary/20">
                    <Check className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium flex-1">
                      #{selectedTargetInfo.confirmation_number} - {selectedTargetInfo.guest_name} ({formatLocalDate(selectedTargetInfo.check_in_date, "MMM d, yyyy")})
                    </span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 w-6 p-0" 
                      onClick={clearSelectedReservation}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}

                {/* Search Results */}
                {isSearching && (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                )}

                {!isSearching && searchResults.length > 0 && !selectedTargetInfo && (
                  <div className="space-y-2">
                    <div className="text-sm text-muted-foreground">
                      Showing {searchResults.length} of {totalResultCount} results
                    </div>
                    <div className="border rounded-lg max-h-60 overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Confirmation</TableHead>
                            <TableHead>Guest</TableHead>
                            <TableHead>Check-in</TableHead>
                            <TableHead className="w-20"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {searchResults.map((res) => (
                            <TableRow key={res.id}>
                              <TableCell className="font-mono">#{res.confirmation_number}</TableCell>
                              <TableCell>{res.guest_name}</TableCell>
                              <TableCell>{formatLocalDate(res.check_in_date, "MMM d, yyyy")}</TableCell>
                              <TableCell>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => selectReservation(res)}
                                >
                                  Select
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {searchResults.length < totalResultCount && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="w-full"
                        onClick={handleLoadMore}
                        disabled={isSearching}
                      >
                        Load More
                      </Button>
                    )}
                  </div>
                )}

                {!isSearching && reservationSearch.length >= 2 && searchResults.length === 0 && !selectedTargetInfo && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No matching reservations found
                  </p>
                )}

                {reservationSearch.length < 2 && !selectedTargetInfo && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Enter at least 2 characters to search
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsActionDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={actionType === "refund" ? handleRefund : handleTransfer}
              disabled={isProcessing || (actionType === "transfer" && !selectedTarget)}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                actionType === "refund" ? "Confirm Refund" : "Confirm Transfer"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
