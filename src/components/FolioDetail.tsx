import { useEffect, useState, useMemo, forwardRef, useImperativeHandle } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { getRevenueAccountTaxes, calculateTaxes } from "@/lib/taxCalculations";
import { useAuditDate } from "@/contexts/AuditDateContext";
import { AlertTriangle, RotateCcw } from "lucide-react";
import {
  Receipt,
  ChevronDown,
  ChevronUp,
  Loader2,
  Home,
  DollarSign,
  CreditCard,
  RefreshCw,
  ArrowRightLeft,
  FileText,
  Plus,
  Minus,
  Building,
  LogOut,
  Printer,
} from "lucide-react";
import { FolioPrintDialog } from "./FolioPrintDialog";
import { usePropertyTerminology } from "@/hooks/usePropertyTerminology";

interface FolioPosting {
  id: string;
  posting_type: string;
  description: string;
  amount: number; // Legacy - kept for backward compatibility
  debit_amount: number;
  credit_amount: number;
  running_balance: number;
  posting_date: string;
  created_at: string;
  posted_by_name: string | null;
  account_id: string | null;
  is_voided?: boolean;
  voided_at?: string | null;
  voided_by_name?: string | null;
  voided_posting_id?: string | null;
  accounts?: {
    code: string;
    name: string;
  } | null;
}

interface LedgerAccount {
  id: string;
  ledger_type: string;
  balance: number;
  is_active: boolean;
  opened_at: string;
  closed_at: string | null;
  company_name?: string | null;
  contact_name?: string | null;
}

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

interface PaymentCard {
  id: string;
  card_brand: string;
  last_four_digits: string;
  cardholder_name: string;
  is_primary: boolean | null;
}

interface FolioDetailProps {
  reservationId: string;
  ledgerAccountId?: string; // Optional - if provided, load this specific ledger account
  onBalanceChange?: (newBalance: number) => void;
  onPostingsChange?: (postings: FolioPosting[]) => void;
  defaultCollapsed?: boolean;
}

export interface FolioDetailRef {
  openPaymentDialog: (amount?: number, onCheckoutAfterPayment?: () => Promise<void>) => void;
  openPostingDialog: (type?: "charge" | "payment" | "adjustment" | "refund") => void;
  expand: () => void;
}

export const FolioDetail = forwardRef<FolioDetailRef, FolioDetailProps>(function FolioDetail(
  { reservationId, ledgerAccountId, onBalanceChange, onPostingsChange, defaultCollapsed = false },
  ref
) {
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(!defaultCollapsed);
  const [ledgerAccount, setLedgerAccount] = useState<LedgerAccount | null>(null);
  const [postings, setPostings] = useState<FolioPosting[]>([]);
  const [advanceDeposit, setAdvanceDeposit] = useState<LedgerAccount | null>(null);
  const [advancePostings, setAdvancePostings] = useState<FolioPosting[]>([]);

  // Derive the folio balance from postings (source of truth) so the UI stays
  // accurate even if the cached ledger_accounts.balance column drifts.
  const displayBalance = useMemo(() => {
    return (postings || []).reduce((sum, p) => {
      if (p.is_voided) return sum;
      return sum + (Number(p.debit_amount) || 0) - (Number(p.credit_amount) || 0);
    }, 0);
  }, [postings]);

  // Keep parent and cached ledger balance in sync with the derived value.
  useEffect(() => {
    onBalanceChange?.(displayBalance);
    if (
      ledgerAccount &&
      Math.abs((Number(ledgerAccount.balance) || 0) - displayBalance) > 0.005
    ) {
      // Update local state immediately so the header reflects the truth
      setLedgerAccount({ ...ledgerAccount, balance: displayBalance });
      // Best-effort reconcile the cached column in the database
      supabase
        .from("ledger_accounts")
        .update({ balance: displayBalance })
        .eq("id", ledgerAccount.id)
        .then(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayBalance, ledgerAccount?.id]);


  // Manual posting state
  const [isPostingDialogOpen, setIsPostingDialogOpen] = useState(false);
  const [postingType, setPostingType] = useState<"charge" | "payment" | "adjustment" | "refund">("charge");
  const [postingDescription, setPostingDescription] = useState("");
  const [postingAmount, setPostingAmount] = useState("");
  const [postingAccountId, setPostingAccountId] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Checkout flow state - tracks if payment was initiated from checkout
  const [pendingCheckout, setPendingCheckout] = useState(false);
  const [checkoutCallback, setCheckoutCallback] = useState<(() => Promise<void>) | null>(null);

  // Void dialog state
  const [isVoidDialogOpen, setIsVoidDialogOpen] = useState(false);
  const [postingToVoid, setPostingToVoid] = useState<FolioPosting | null>(null);

  // Get audit date from context
  const { auditDate } = useAuditDate();

  // Transfer dialog state
  const [isTransferDialogOpen, setIsTransferDialogOpen] = useState(false);
  const [transferDirection, setTransferDirection] = useState<"advance_to_guest" | "guest_to_city">("advance_to_guest");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDescription, setTransferDescription] = useState("");
  const [cityLedgers, setCityLedgers] = useState<LedgerAccount[]>([]);
  const [selectedCityLedgerId, setSelectedCityLedgerId] = useState("");
  const [linkedCityLedger, setLinkedCityLedger] = useState<{ company_name: string | null } | null>(null);

  // Payment cards state
  const [paymentCards, setPaymentCards] = useState<PaymentCard[]>([]);

  // Print/email dialog
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const terminology = usePropertyTerminology();

  // Reset collapsed state when reservation changes
  useEffect(() => {
    setIsOpen(!defaultCollapsed);
  }, [reservationId, defaultCollapsed]);

  useEffect(() => {
    loadFolioData();
    loadAccounts();
    loadCityLedgers();
    loadLinkedCityLedger();
    loadPaymentCards();
  }, [reservationId, ledgerAccountId]);

  const loadLinkedCityLedger = async () => {
    const { data } = await supabase
      .from("reservations")
      .select("city_ledger_account_id, city_ledger:city_ledger_account_id(company_name)")
      .eq("id", reservationId)
      .single();

    if (data?.city_ledger) {
      setLinkedCityLedger(data.city_ledger as { company_name: string | null });
    }
  };

  const loadCityLedgers = async () => {
    const { data } = await supabase
      .from("ledger_accounts")
      .select("*")
      .eq("ledger_type", "city")
      .eq("is_active", true)
      .order("company_name");

    setCityLedgers(data || []);
  };

  const loadAccounts = async () => {
    // First get the property_id from the reservation
    const { data: reservation } = await supabase
      .from("reservations")
      .select("property_id")
      .eq("id", reservationId)
      .single();

    if (!reservation) return;

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
      .eq("property_id", reservation.property_id)
      .eq("is_active", true)
      .order("code");

    setAccounts(data || []);
  };

  const loadFolioData = async () => {
    setLoading(true);

    let guestLedger = null;

    // If ledgerAccountId is provided, load that specific account
    if (ledgerAccountId) {
      const { data } = await supabase
        .from("ledger_accounts")
        .select("*")
        .eq("id", ledgerAccountId)
        .single();
      guestLedger = data;
    } else {
      // Otherwise, load guest ledger account for this reservation (legacy behavior)
      const { data } = await supabase
        .from("ledger_accounts")
        .select("*")
        .eq("reservation_id", reservationId)
        .eq("ledger_type", "guest")
        .maybeSingle();
      guestLedger = data;
    }

    // Load advance deposit ledger account for this reservation
    const { data: advanceLedger } = await supabase
      .from("ledger_accounts")
      .select("*")
      .eq("reservation_id", reservationId)
      .eq("ledger_type", "advance_deposit")
      .maybeSingle();

    setLedgerAccount(guestLedger);
    setAdvanceDeposit(advanceLedger);

    // Load postings for guest ledger
    if (guestLedger) {
      const { data: guestPostings } = await supabase
        .from("folio_postings")
        .select(`
          *,
          accounts:account_id (code, name)
        `)
        .eq("ledger_account_id", guestLedger.id)
        .order("created_at", { ascending: true });

      setPostings(guestPostings || []);
      onPostingsChange?.(guestPostings || []);
    }

    // Load postings for advance deposit ledger
    if (advanceLedger) {
      const { data: depositPostings } = await supabase
        .from("folio_postings")
        .select(`
          *,
          accounts:account_id (code, name)
        `)
        .eq("ledger_account_id", advanceLedger.id)
        .order("created_at", { ascending: true });

      setAdvancePostings(depositPostings || []);
    }

    setLoading(false);
  };

  const handlePostManualCharge = async () => {
    if (!ledgerAccount) {
      toast.error("No active guest folio found");
      return;
    }

    const amount = parseFloat(postingAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (!postingDescription.trim()) {
      toast.error("Please enter a description");
      return;
    }

    setIsSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const staffName = user?.user_metadata?.first_name 
        ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`
        : 'Staff';

      // Get current balance
      const { data: lastPosting } = await supabase
        .from("folio_postings")
        .select("running_balance")
        .eq("ledger_account_id", ledgerAccount.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const currentBalance = lastPosting?.running_balance || ledgerAccount.balance;
      
      // Calculate new balance based on posting type
      // Foundational debit/credit logic:
      // - Charges, taxes, refunds = Debit (increases balance)
      // - Payments = Credit (decreases balance)
      let runningBalance: number;
      let postAmount: number;
      let transactionType: "charge" | "payment" | "adjustment" | "refund";
      let debitAmount: number;
      let creditAmount: number;
      
      if (postingType === "payment") {
        // Payment = Credit (decreases what guest owes)
        postAmount = -amount;
        runningBalance = currentBalance - amount;
        transactionType = "payment";
        debitAmount = 0;
        creditAmount = Math.abs(amount);
      } else if (postingType === "refund") {
        // Refund = Debit (increases what guest owes - we're giving money back)
        postAmount = amount;
        runningBalance = currentBalance + amount;
        transactionType = "refund";
        debitAmount = Math.abs(amount);
        creditAmount = 0;
      } else if (postingType === "adjustment" && amount < 0) {
        postAmount = amount;
        runningBalance = currentBalance + amount;
        transactionType = "adjustment";
        debitAmount = 0;
        creditAmount = Math.abs(amount);
      } else {
        // Charge = Debit (increases balance)
        postAmount = amount;
        runningBalance = currentBalance + amount;
        transactionType = postingType === "adjustment" ? "adjustment" : "charge";
        debitAmount = Math.abs(amount);
        creditAmount = 0;
      }

      // Create folio posting with explicit debit/credit
      const { error: postingError } = await supabase.from("folio_postings").insert({
        ledger_account_id: ledgerAccount.id,
        posting_type: postingType,
        description: postingDescription,
        amount: postAmount, // Legacy field
        debit_amount: debitAmount,
        credit_amount: creditAmount,
        running_balance: runningBalance,
        posting_date: auditDate,
        posted_by: user?.id,
        posted_by_name: staffName,
        account_id: postingAccountId || null,
      });

      if (postingError) throw postingError;

      // Create ledger transaction
      await supabase.from("ledger_transactions").insert({
        ledger_account_id: ledgerAccount.id,
        transaction_type: transactionType,
        description: postingDescription,
        debit_amount: debitAmount,
        credit_amount: creditAmount,
        posted_by_name: staffName,
        account_id: postingAccountId || null,
      });

      // Calculate and post taxes for charges if the account has taxes configured
      if (postingType === "charge" && postingAccountId) {
        const taxConfigs = await getRevenueAccountTaxes(postingAccountId);
        if (taxConfigs.length > 0) {
          // Get reservation adults count for per-adult taxes
          const { data: reservation } = await supabase
            .from("reservations")
            .select("adults_count")
            .eq("id", reservationId)
            .maybeSingle();
          
          const adultsCount = reservation?.adults_count || 1;
          const calculatedTaxes = calculateTaxes(amount, taxConfigs, {
            numberOfDays: 1,
            numberOfAdults: adultsCount,
          });

          for (const tax of calculatedTaxes) {
            if (tax.calculatedAmount > 0) {
              runningBalance += tax.calculatedAmount;
              
              // Post tax to folio_postings
              await supabase.from("folio_postings").insert({
                ledger_account_id: ledgerAccount.id,
                posting_type: "tax",
                description: `${tax.taxAccountCode} - ${tax.taxAccountName}`,
                amount: tax.calculatedAmount,
                debit_amount: tax.calculatedAmount,
                credit_amount: 0,
                running_balance: runningBalance,
                posting_date: auditDate,
                posted_by: user?.id,
                posted_by_name: staffName,
                account_id: tax.taxAccountId,
              });

              // Post tax to ledger_transactions
              await supabase.from("ledger_transactions").insert({
                ledger_account_id: ledgerAccount.id,
                transaction_type: "charge",
                description: `Tax: ${tax.taxAccountName}`,
                debit_amount: tax.calculatedAmount,
                credit_amount: 0,
                posted_by_name: staffName,
                account_id: tax.taxAccountId,
                account_code: tax.taxAccountCode,
              });
            }
          }
        }
      }

      // Update ledger account balance with final balance (including taxes)
      await supabase
        .from("ledger_accounts")
        .update({ balance: runningBalance })
        .eq("id", ledgerAccount.id);

      const typeLabel = postingType === "payment" ? "Payment" : 
                       postingType === "refund" ? "Refund" : 
                       postingType === "adjustment" ? "Adjustment" : "Charge";
      toast.success(`${typeLabel} posted successfully`);
      
      // Reset form and reload
      setIsPostingDialogOpen(false);
      setPostingDescription("");
      setPostingAmount("");
      setPostingAccountId("");
      setPostingType("charge");
      loadFolioData();
    } catch (error) {
      console.error("Error posting:", error);
      toast.error("Failed to post");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle void posting - only for same audit date postings
  const handleVoidPosting = async () => {
    if (!postingToVoid || !ledgerAccount) {
      toast.error("No posting selected to void");
      return;
    }

    // Check if posting is from current audit date
    const postingDate = format(parseISO(postingToVoid.posting_date), 'yyyy-MM-dd');
    if (postingDate !== auditDate) {
      toast.error("Can only void postings from the current audit date");
      setIsVoidDialogOpen(false);
      setPostingToVoid(null);
      return;
    }

    setIsSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const staffName = user?.user_metadata?.first_name 
        ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`
        : 'Staff';

      // Get current balance for new running balance
      const { data: lastPosting } = await supabase
        .from("folio_postings")
        .select("running_balance")
        .eq("ledger_account_id", ledgerAccount.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const currentBalance = lastPosting?.running_balance || ledgerAccount.balance;

      // Create reversing entry - swap debit/credit
      const reversedDebit = postingToVoid.credit_amount || 0;
      const reversedCredit = postingToVoid.debit_amount || 0;
      
      // Calculate new balance: credits reduce balance, debits increase balance
      const balanceChange = reversedDebit - reversedCredit;
      const newBalance = currentBalance + balanceChange;

      // Create the void posting (reversing entry)
      const { error: voidPostingError } = await supabase.from("folio_postings").insert({
        ledger_account_id: ledgerAccount.id,
        posting_type: "void",
        description: `VOID: ${postingToVoid.description}`,
        amount: -(postingToVoid.amount || 0), // Reverse the legacy amount
        debit_amount: reversedDebit,
        credit_amount: reversedCredit,
        running_balance: newBalance,
        posting_date: auditDate,
        posted_by: user?.id,
        posted_by_name: staffName,
        account_id: postingToVoid.account_id,
        voided_posting_id: postingToVoid.id,
      });

      if (voidPostingError) throw voidPostingError;

      // Mark the original posting as voided
      const { error: updateError } = await supabase
        .from("folio_postings")
        .update({
          is_voided: true,
          voided_at: new Date().toISOString(),
          voided_by: user?.id,
          voided_by_name: staffName,
        })
        .eq("id", postingToVoid.id);

      if (updateError) throw updateError;

      // Create ledger transaction for the void
      await supabase.from("ledger_transactions").insert({
        ledger_account_id: ledgerAccount.id,
        transaction_type: "adjustment",
        description: `VOID: ${postingToVoid.description}`,
        debit_amount: reversedDebit,
        credit_amount: reversedCredit,
        posted_by_name: staffName,
        account_id: postingToVoid.account_id,
      });

      // Update ledger account balance
      await supabase
        .from("ledger_accounts")
        .update({ balance: newBalance })
        .eq("id", ledgerAccount.id);

      toast.success("Posting voided successfully");
      setIsVoidDialogOpen(false);
      setPostingToVoid(null);
      loadFolioData();
    } catch (error) {
      console.error("Error voiding posting:", error);
      toast.error("Failed to void posting");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle opening refund dialog with card pre-selection
  const handleOpenRefundDialog = () => {
    setPostingType("refund");
    
    // If there's a card on file, pre-select the appropriate account
    if (cardOnFile) {
      const accountId = getAccountForCardBrand(cardOnFile.card_brand);
      if (accountId) {
        setPostingAccountId(accountId);
      }
      setPostingDescription(`Refund: ${cardOnFile.card_brand} •••• ${cardOnFile.last_four_digits}`);
    } else {
      setPostingAccountId("");
      setPostingDescription("");
    }
    
    setIsPostingDialogOpen(true);
  };

  // Check if a posting can be voided (same audit date and not already voided)
  const canVoidPosting = (posting: FolioPosting): boolean => {
    if (posting.is_voided) return false;
    if (posting.posting_type === "void") return false;
    if (!auditDate) return false;
    const postingDate = format(parseISO(posting.posting_date), 'yyyy-MM-dd');
    return postingDate === auditDate;
  };

  const handleTransfer = async () => {
    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (transferDirection === "advance_to_guest" && !advanceDeposit) {
      toast.error("No advance deposit ledger found");
      return;
    }

    if (transferDirection === "advance_to_guest" && !ledgerAccount) {
      toast.error("No guest ledger found");
      return;
    }

    if (transferDirection === "guest_to_city" && !selectedCityLedgerId) {
      toast.error("Please select a city ledger account");
      return;
    }

    if (transferDirection === "advance_to_guest" && advanceDeposit && amount > advanceDeposit.balance) {
      toast.error("Transfer amount exceeds advance deposit balance");
      return;
    }

    if (transferDirection === "guest_to_city" && ledgerAccount && amount > ledgerAccount.balance) {
      toast.error("Transfer amount exceeds guest ledger balance");
      return;
    }

    setIsSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const staffName = user?.user_metadata?.first_name 
        ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`
        : 'Staff';

      const description = transferDescription.trim() || 
        (transferDirection === "advance_to_guest" ? "Transfer from Advance Deposit" : "Transfer to City Ledger");

      if (transferDirection === "advance_to_guest" && advanceDeposit && ledgerAccount) {
        // Transfer from advance deposit to guest ledger
        
        // Debit (reduce) advance deposit
        await supabase.from("ledger_transactions").insert({
          ledger_account_id: advanceDeposit.id,
          transaction_type: "transfer",
          description: `Transfer to Guest Folio: ${description}`,
          credit_amount: amount,
          debit_amount: 0,
          posted_by_name: staffName,
        });

        await supabase.from("folio_postings").insert({
          ledger_account_id: advanceDeposit.id,
          posting_type: "transfer",
          description: `Transfer Out: ${description}`,
          amount: -amount, // Legacy field
          debit_amount: 0,
          credit_amount: amount,
          running_balance: advanceDeposit.balance - amount,
          posted_by: user?.id,
          posted_by_name: staffName,
        });

        // Update advance deposit balance
        await supabase
          .from("ledger_accounts")
          .update({ balance: advanceDeposit.balance - amount })
          .eq("id", advanceDeposit.id);

        // Credit (reduce what guest owes) guest ledger
        await supabase.from("ledger_transactions").insert({
          ledger_account_id: ledgerAccount.id,
          transaction_type: "transfer",
          description: `Advance Deposit Transfer: ${description}`,
          credit_amount: amount,
          debit_amount: 0,
          posted_by_name: staffName,
        });

        // Get current guest folio balance for running balance
        const { data: lastGuestPosting } = await supabase
          .from("folio_postings")
          .select("running_balance")
          .eq("ledger_account_id", ledgerAccount.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const currentGuestBalance = lastGuestPosting?.running_balance || ledgerAccount.balance;

        await supabase.from("folio_postings").insert({
          ledger_account_id: ledgerAccount.id,
          posting_type: "transfer",
          description: `Transfer In: ${description}`,
          amount: -amount, // Legacy field (negative = credit)
          debit_amount: 0,
          credit_amount: amount,
          running_balance: currentGuestBalance - amount,
          posted_by: user?.id,
          posted_by_name: staffName,
        });

        // Update guest ledger balance
        await supabase
          .from("ledger_accounts")
          .update({ balance: ledgerAccount.balance - amount })
          .eq("id", ledgerAccount.id);

        toast.success("Balance transferred from advance deposit to guest folio");
      } else if (transferDirection === "guest_to_city" && ledgerAccount) {
        // Transfer from guest ledger to city ledger
        
        // Get current guest folio balance for running balance
        const { data: lastGuestPosting } = await supabase
          .from("folio_postings")
          .select("running_balance")
          .eq("ledger_account_id", ledgerAccount.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const currentGuestBalance = lastGuestPosting?.running_balance || ledgerAccount.balance;

        // Debit (reduce) guest ledger
        await supabase.from("ledger_transactions").insert({
          ledger_account_id: ledgerAccount.id,
          transaction_type: "transfer",
          description: `Transfer to City Ledger: ${description}`,
          credit_amount: amount,
          debit_amount: 0,
          posted_by_name: staffName,
        });

        await supabase.from("folio_postings").insert({
          ledger_account_id: ledgerAccount.id,
          posting_type: "transfer",
          description: `Transfer Out to City Ledger: ${description}`,
          amount: -amount, // Legacy field
          debit_amount: 0,
          credit_amount: amount,
          running_balance: currentGuestBalance - amount,
          posted_by: user?.id,
          posted_by_name: staffName,
        });

        // Update guest ledger balance
        await supabase
          .from("ledger_accounts")
          .update({ balance: ledgerAccount.balance - amount })
          .eq("id", ledgerAccount.id);

        // Get city ledger for posting
        const { data: cityLedger } = await supabase
          .from("ledger_accounts")
          .select("balance")
          .eq("id", selectedCityLedgerId)
          .single();

        if (cityLedger) {
          // Get reservation details for invoice
          const { data: reservation } = await supabase
            .from("reservations")
            .select(`
              confirmation_number,
              check_out_date,
              property_id,
              guests (first_name, last_name),
              sites (site_number)
            `)
            .eq("id", reservationId)
            .single();

          // Credit city ledger (increases AR)
          await supabase.from("ledger_transactions").insert({
            ledger_account_id: selectedCityLedgerId,
            transaction_type: "transfer",
            description: `Transfer from Guest Folio: ${description}`,
            debit_amount: amount,
            credit_amount: 0,
            posted_by_name: staffName,
          });

          await supabase.from("folio_postings").insert({
            ledger_account_id: selectedCityLedgerId,
            posting_type: "transfer",
            description: `Transfer In from Guest Folio: ${description}`,
            amount: amount, // Legacy field
            debit_amount: amount,
            credit_amount: 0,
            running_balance: cityLedger.balance + amount,
            posted_by: user?.id,
            posted_by_name: staffName,
          });

          // Create city ledger invoice for tracking
          await supabase.from("city_ledger_invoices").insert({
            city_ledger_account_id: selectedCityLedgerId,
            source_folio_id: ledgerAccount.id,
            reservation_id: reservationId,
            confirmation_number: reservation?.confirmation_number || null,
            guest_name: reservation?.guests 
              ? `${reservation.guests.first_name} ${reservation.guests.last_name}`
              : null,
            room_number: reservation?.sites?.site_number || null,
            checkout_date: reservation?.check_out_date || null,
            transfer_date: new Date().toISOString().split('T')[0],
            original_amount: amount,
            property_id: reservation?.property_id,
            status: 'open',
          });

          // Update city ledger balance
          await supabase
            .from("ledger_accounts")
            .update({ balance: cityLedger.balance + amount })
            .eq("id", selectedCityLedgerId);
        }

        toast.success("Balance transferred to city ledger");
      }

      // Reset form and reload
      setIsTransferDialogOpen(false);
      setTransferAmount("");
      setTransferDescription("");
      setSelectedCityLedgerId("");
      loadFolioData();
    } catch (error) {
      console.error("Error processing transfer:", error);
      toast.error("Failed to process transfer");
    } finally {
      setIsSaving(false);
    }
  };

  const revenueAccounts = accounts.filter(
    (a) => a.account_groups?.account_type === "revenue"
  );

  // Include asset and liability accounts for payments
  const paymentAccounts = accounts.filter(
    (a) => a.account_groups?.account_type === "asset" || 
           a.account_groups?.account_type === "liability"
  );

  // Get the appropriate account for a card brand using payment_type field
  const getAccountForCardBrand = (cardBrand: string): string | null => {
    const brandLower = cardBrand?.toLowerCase() || '';
    
    // First try to match using the payment_type field (preferred method)
    const matchByPaymentType = paymentAccounts.find(account => {
      const paymentType = account.payment_type?.toLowerCase() || '';
      if (brandLower === 'visa') return paymentType === 'visa';
      if (brandLower === 'mastercard' || brandLower === 'mc') return paymentType === 'mastercard';
      if (brandLower === 'amex' || brandLower === 'american express') return paymentType === 'amex';
      if (brandLower === 'discover') return paymentType === 'discover';
      return false;
    });
    
    if (matchByPaymentType) {
      return matchByPaymentType.id;
    }
    
    // Fallback to name-based matching for legacy accounts without payment_type
    const matchByName = paymentAccounts.find(account => {
      const accountName = account.name.toLowerCase();
      const accountCode = account.code.toLowerCase();
      
      if (brandLower === 'visa') {
        return accountName.includes('visa') || accountName.includes('mc/vs') || accountCode.includes('visa');
      }
      if (brandLower === 'mastercard' || brandLower === 'mc') {
        return accountName.includes('mastercard') || accountName.includes('mc') || 
               accountName.includes('mc/vs') || accountCode.includes('mc');
      }
      if (brandLower === 'amex' || brandLower === 'american express') {
        return accountName.includes('amex') || accountName.includes('american express') ||
               accountName === 'ax' || accountCode.includes('ax') || accountCode.includes('amex');
      }
      if (brandLower === 'discover') {
        return accountName.includes('discover');
      }
      return false;
    });
    
    return matchByName?.id || null;
  };

  // Load payment cards for this reservation
  const loadPaymentCards = async () => {
    const { data } = await supabase
      .from('payment_cards')
      .select('id, card_brand, last_four_digits, cardholder_name, is_primary')
      .eq('reservation_id', reservationId)
      .order('is_primary', { ascending: false });
    
    setPaymentCards(data || []);
  };

  // Get the primary or first card on file
  const cardOnFile = paymentCards.find(c => c.is_primary) || paymentCards[0] || null;

  // Handle opening payment dialog with card pre-selection
  const handleOpenPaymentDialog = () => {
    setPostingType("payment");
    
    // If there's a card on file, pre-select the appropriate account
    if (cardOnFile) {
      const accountId = getAccountForCardBrand(cardOnFile.card_brand);
      if (accountId) {
        setPostingAccountId(accountId);
      }
      setPostingDescription(`${cardOnFile.card_brand} •••• ${cardOnFile.last_four_digits}`);
    } else {
      setPostingAccountId("");
      setPostingDescription("");
    }
    
    setIsPostingDialogOpen(true);
  };

  // Expose openPaymentDialog method via ref for parent components
  useImperativeHandle(ref, () => ({
    openPaymentDialog: (amount?: number, onCheckoutAfterPayment?: () => Promise<void>) => {
      setPostingType("payment");
      
      // If there's a card on file, pre-select the appropriate account
      if (cardOnFile) {
        const accountId = getAccountForCardBrand(cardOnFile.card_brand);
        if (accountId) {
          setPostingAccountId(accountId);
        }
        setPostingDescription(`${cardOnFile.card_brand} •••• ${cardOnFile.last_four_digits}`);
      } else {
        setPostingAccountId("");
        setPostingDescription("");
      }
      
      // Pre-fill amount if provided (e.g., balance due)
      if (amount !== undefined && amount > 0) {
        setPostingAmount(amount.toFixed(2));
      }
      
      // Track if this is a checkout-triggered payment
      if (onCheckoutAfterPayment) {
        setPendingCheckout(true);
        setCheckoutCallback(() => onCheckoutAfterPayment);
      } else {
        setPendingCheckout(false);
        setCheckoutCallback(null);
      }
      
      setIsPostingDialogOpen(true);
    },
    openPostingDialog: (type: "charge" | "payment" | "adjustment" | "refund" = "charge") => {
      setIsOpen(true);
      setPostingType(type);
      if (type === "payment" && cardOnFile) {
        const accountId = getAccountForCardBrand(cardOnFile.card_brand);
        if (accountId) setPostingAccountId(accountId);
        setPostingDescription(`${cardOnFile.card_brand} •••• ${cardOnFile.last_four_digits}`);
      } else {
        setPostingAccountId("");
        setPostingDescription("");
      }
      setPostingAmount("");
      setIsPostingDialogOpen(true);
    },
    expand: () => setIsOpen(true),
  }), [cardOnFile, accounts]);

  const getPostingIcon = (type: string, isVoided?: boolean) => {
    if (isVoided) return <RotateCcw className="h-4 w-4" />;
    switch (type) {
      case "room":
      case "revenue":
      case "charge":
        return <Home className="h-4 w-4" />;
      case "tax":
        return <FileText className="h-4 w-4" />;
      case "payment":
        return <CreditCard className="h-4 w-4" />;
      case "refund":
        return <RefreshCw className="h-4 w-4" />;
      case "transfer":
        return <ArrowRightLeft className="h-4 w-4" />;
      case "void":
        return <RotateCcw className="h-4 w-4" />;
      default:
        return <DollarSign className="h-4 w-4" />;
    }
  };

  const getPostingBadgeColor = (type: string, isVoided?: boolean) => {
    if (isVoided) return "bg-gray-500/10 text-gray-500 line-through";
    switch (type) {
      case "room":
      case "revenue":
      case "charge":
        return "bg-blue-500/10 text-blue-700";
      case "tax":
        return "bg-purple-500/10 text-purple-700";
      case "payment":
        return "bg-green-500/10 text-green-700";
      case "refund":
        return "bg-orange-500/10 text-orange-700";
      case "transfer":
        return "bg-yellow-500/10 text-yellow-700";
      case "void":
        return "bg-red-500/10 text-red-700";
      default:
        return "bg-gray-500/10 text-gray-700";
    }
  };

  const calculateTotals = (items: FolioPosting[]) => {
    const charges = items.reduce((sum, p) => sum + (p.debit_amount || 0), 0);
    const payments = items.reduce((sum, p) => sum + (p.credit_amount || 0), 0);
    
    return { charges, payments, refunds: 0 };
  };

  const guestTotals = calculateTotals(postings);
  const advanceTotals = calculateTotals(advancePostings);

  const renderPostingsTable = (items: FolioPosting[], title: string) => {
    if (items.length === 0) {
      return (
        <div className="text-center py-4 text-muted-foreground text-xs">
          No {title.toLowerCase()} postings yet
        </div>
      );
    }

    return (
      <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="text-xs">
            <TableHead className="py-2">Date</TableHead>
            <TableHead className="py-2">Type</TableHead>
            <TableHead className="py-2">Description</TableHead>
            <TableHead className="py-2">Account</TableHead>
            <TableHead className="py-2 text-right">Debit</TableHead>
            <TableHead className="py-2 text-right">Credit</TableHead>
            <TableHead className="py-2 text-right">Balance</TableHead>
            <TableHead className="py-2 w-[40px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((posting) => (
            <TableRow key={posting.id} className={`text-xs ${posting.is_voided ? "opacity-50" : ""}`}>
              <TableCell className="py-1.5 whitespace-nowrap">
                {format(parseISO(posting.created_at), "MM/dd HH:mm")}
              </TableCell>
              <TableCell className="py-1.5">
                <Badge className={`${getPostingBadgeColor(posting.posting_type, posting.is_voided)} flex items-center gap-0.5 w-fit text-[10px] px-1.5 py-0 h-5`}>
                  {getPostingIcon(posting.posting_type, posting.is_voided)}
                  <span className={`capitalize ${posting.is_voided ? "line-through" : ""}`}>
                    {posting.is_voided ? "void" : posting.posting_type}
                  </span>
                </Badge>
              </TableCell>
              <TableCell 
                className={`py-1.5 max-w-[220px] truncate ${posting.is_voided ? "line-through" : ""}`} 
                title={`${posting.accounts?.name || ""} ${posting.description || ""}`.trim()}
              >
                {(() => {
                  const accountName = posting.accounts?.name || "";
                  const userDesc = posting.description?.trim() || "";
                  const maxUserDescLen = 20;
                  const truncatedDesc = userDesc.length > maxUserDescLen 
                    ? userDesc.substring(0, maxUserDescLen) + "..." 
                    : userDesc;
                  return accountName && truncatedDesc 
                    ? `${accountName} ${truncatedDesc}` 
                    : accountName || truncatedDesc || "-";
                })()}
              </TableCell>
              <TableCell className={`py-1.5 text-right font-medium ${posting.is_voided ? "line-through" : ""}`}>
                {(posting.debit_amount || 0) > 0 ? `$${posting.debit_amount.toFixed(2)}` : '-'}
              </TableCell>
              <TableCell className={`py-1.5 text-right font-medium text-green-600 ${posting.is_voided ? "line-through" : ""}`}>
                {(posting.credit_amount || 0) > 0 ? `$${posting.credit_amount.toFixed(2)}` : '-'}
              </TableCell>
              <TableCell className="py-1.5 text-right font-medium">
                ${posting.running_balance.toFixed(2)}
              </TableCell>
              <TableCell className="py-1.5">
                {canVoidPosting(posting) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => {
                      setPostingToVoid(posting);
                      setIsVoidDialogOpen(true);
                    }}
                    title="Void this posting"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    );
  };

  if (loading) {
    return (
      <Card className="p-3 sm:p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Card>
    );
  }

  // If no ledger accounts exist, show a message
  if (!ledgerAccount && !advanceDeposit) {
    return (
      <Card className="p-3 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Receipt className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Guest Folio</h2>
        </div>
        <div className="text-center py-8 text-muted-foreground">
          No folio has been created for this reservation yet.
          <p className="text-sm mt-1">A folio will be created when the guest checks in.</p>
        </div>
      </Card>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="p-3 sm:p-6">
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full flex items-center justify-between gap-2 p-0 h-auto hover:bg-transparent">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <Receipt className="h-5 w-5 text-primary shrink-0" />
              <h2 className="text-base sm:text-lg font-semibold">Guest Folio</h2>
              {ledgerAccount && (
                <Badge variant={ledgerAccount.is_active ? "default" : "secondary"}>
                  {ledgerAccount.is_active ? "Active" : "Closed"}
                </Badge>
              )}
              {linkedCityLedger?.company_name && (
                <Badge variant="outline" className="gap-1">
                  <Building className="h-3 w-3" />
                  <span className="truncate max-w-[140px] sm:max-w-none">Direct Bill: {linkedCityLedger.company_name}</span>
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              {ledgerAccount && (
                <span className={`text-sm sm:text-lg font-bold whitespace-nowrap ${
                  displayBalance > 0 ? "text-red-600" : 
                  displayBalance < 0 ? "text-green-600" : "text-foreground"
                }`}>
                  <span className="hidden sm:inline">Balance: </span>${displayBalance.toFixed(2)}
                </span>
              )}
              {isOpen ? <ChevronUp className="h-5 w-5 shrink-0" /> : <ChevronDown className="h-5 w-5 shrink-0" />}
            </div>
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-4">
          {/* Print / Email available at every stage of the stay */}
          <div className="flex justify-end mb-3">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => setIsPrintDialogOpen(true)}
            >
              <Printer className="h-3.5 w-3.5 mr-1" />
              Print / Email Folio
            </Button>
          </div>
          {/* Action Buttons - Responsive grid layout */}
          {ledgerAccount?.is_active && (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-1.5 mb-4">

              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  setPostingType("charge");
                  setIsPostingDialogOpen(true);
                }}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Charge
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={handleOpenPaymentDialog}
              >
                <CreditCard className="h-3.5 w-3.5 mr-1" />
                Payment
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs"
                onClick={() => {
                  setPostingType("adjustment");
                  setIsPostingDialogOpen(true);
                }}
              >
                <Minus className="h-3.5 w-3.5 mr-1" />
                Adjust
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs text-orange-600 border-orange-300 hover:bg-orange-50 dark:hover:bg-orange-950"
                onClick={handleOpenRefundDialog}
              >
                <RefreshCw className="h-3.5 w-3.5 mr-1" />
                Refund
              </Button>
              {(advanceDeposit?.balance || 0) > 0 && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 text-xs"
                  onClick={() => {
                    setTransferDirection("advance_to_guest");
                    setTransferAmount(advanceDeposit?.balance?.toString() || "");
                    setIsTransferDialogOpen(true);
                  }}
                >
                  <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
                  Deposit
                </Button>
              )}
              {(ledgerAccount?.balance || 0) > 0 && cityLedgers.length > 0 && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="h-8 text-xs"
                  onClick={() => {
                    setTransferDirection("guest_to_city");
                    setIsTransferDialogOpen(true);
                  }}
                >
                  <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
                  City
                </Button>
              )}
            </div>
          )}

          {/* Summary Cards - More compact */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Charges</div>
              <div className="text-base font-bold">${guestTotals.charges.toFixed(2)}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Payments</div>
              <div className="text-base font-bold text-green-600">${guestTotals.payments.toFixed(2)}</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="text-xs text-muted-foreground">Balance</div>
              <div className={`text-base font-bold ${
                (ledgerAccount?.balance || 0) > 0 ? "text-red-600" : "text-green-600"
              }`}>
                ${(ledgerAccount?.balance || 0).toFixed(2)}
              </div>
            </div>
          </div>

          {/* Advance Deposit Ledger */}
          {advanceDeposit && advancePostings.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                Advance Deposits
              </h3>
              <div className="border rounded-lg overflow-hidden">
                {renderPostingsTable(advancePostings, "Advance Deposit")}
              </div>
              <div className="flex justify-end mt-2 text-sm text-muted-foreground">
                Deposit Balance: ${advanceDeposit.balance.toFixed(2)}
              </div>
            </div>
          )}

          {/* Guest Ledger */}
          {ledgerAccount && (
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                Guest Ledger Postings
              </h3>
              <div className="border rounded-lg overflow-hidden">
                {renderPostingsTable(postings, "Guest Ledger")}
              </div>
            </div>
          )}

          {/* Posted By Info */}
          {ledgerAccount && (
            <div className="mt-4 text-xs text-muted-foreground">
              Folio opened: {format(parseISO(ledgerAccount.opened_at), "MMM d, yyyy 'at' h:mm a")}
              {ledgerAccount.closed_at && (
                <span className="ml-4">
                  Closed: {format(parseISO(ledgerAccount.closed_at), "MMM d, yyyy 'at' h:mm a")}
                </span>
              )}
            </div>
          )}
        </CollapsibleContent>
      </Card>

      {/* Manual Posting Dialog */}
      <Dialog open={isPostingDialogOpen} onOpenChange={setIsPostingDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {postingType === "charge" && "Post Charge"}
              {postingType === "payment" && "Post Payment"}
              {postingType === "adjustment" && "Post Adjustment"}
              {postingType === "refund" && "Post Refund"}
            </DialogTitle>
            <DialogDescription>
              {postingType === "payment" && ledgerAccount && (
                <>Current balance: <span className="font-semibold">${displayBalance.toFixed(2)}</span></>
              )}
              {postingType === "charge" && "Add a charge to the guest folio"}
              {postingType === "adjustment" && "Make an adjustment to the folio balance"}
              {postingType === "refund" && "Process a refund to the guest"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Card on File Indicator */}
            {(postingType === "payment" || postingType === "refund") && cardOnFile && (
              <div className={`border rounded-lg p-3 flex items-center gap-3 ${
                postingType === "refund" 
                  ? "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800"
                  : "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800"
              }`}>
                <CreditCard className={`h-5 w-5 flex-shrink-0 ${
                  postingType === "refund" ? "text-orange-600 dark:text-orange-400" : "text-blue-600 dark:text-blue-400"
                }`} />
                <div className="flex-1">
                  <p className={`text-sm font-medium ${
                    postingType === "refund" ? "text-orange-900 dark:text-orange-100" : "text-blue-900 dark:text-blue-100"
                  }`}>
                    Card on File: {cardOnFile.card_brand} •••• {cardOnFile.last_four_digits}
                  </p>
                  <p className={`text-xs ${
                    postingType === "refund" ? "text-orange-700 dark:text-orange-300" : "text-blue-700 dark:text-blue-300"
                  }`}>
                    {postingType === "refund" 
                      ? "Refund will be posted using the same account code" 
                      : "Account code pre-selected based on card type"}
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs">
                  {cardOnFile.is_primary ? "Primary" : "On File"}
                </Badge>
              </div>
            )}

            <div>
              <Label>Type</Label>
              <Select value={postingType} onValueChange={(v) => setPostingType(v as "charge" | "payment" | "adjustment" | "refund")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="charge">Charge (increases balance)</SelectItem>
                  <SelectItem value="payment">Payment (decreases balance)</SelectItem>
                  <SelectItem value="refund">Refund (increases balance)</SelectItem>
                  <SelectItem value="adjustment">Adjustment</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>
                {(postingType === "payment" || postingType === "refund") && cardOnFile ? "Account Code *" : "Account *"}
              </Label>
              <Select value={postingAccountId} onValueChange={setPostingAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {(postingType === "payment" || postingType === "refund") ? (
                    paymentAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.code} - {account.name}
                      </SelectItem>
                    ))
                  ) : (
                    revenueAccounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.code} - {account.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Amount *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={postingAmount}
                onChange={(e) => setPostingAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label>Description (optional)</Label>
              <Input
                value={postingDescription}
                onChange={(e) => setPostingDescription(e.target.value)}
                placeholder="Enter description for this posting"
              />
            </div>
          </div>

          <DialogFooter className="flex-col gap-3 pt-4 border-t">
            {/* Primary actions */}
            <div className="flex flex-col-reverse sm:flex-row gap-2 w-full">
              <Button variant="outline" onClick={() => {
                setIsPostingDialogOpen(false);
                setPendingCheckout(false);
                setCheckoutCallback(null);
              }} className="sm:mr-auto">
                Cancel
              </Button>
              
              <div className="flex flex-col sm:flex-row gap-2">
                <Button onClick={handlePostManualCharge} disabled={isSaving} variant="secondary">
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Posting...
                    </>
                  ) : (
                    <>
                      {postingType === "charge" && <Plus className="h-4 w-4 mr-2" />}
                      {postingType === "payment" && <CreditCard className="h-4 w-4 mr-2" />}
                      {postingType === "adjustment" && <Minus className="h-4 w-4 mr-2" />}
                      {postingType === "refund" && <RefreshCw className="h-4 w-4 mr-2" />}
                      Post {postingType === "charge" ? "Charge" : postingType === "payment" ? "Payment" : postingType === "refund" ? "Refund" : "Adjustment"}
                    </>
                  )}
                </Button>
                
                {pendingCheckout && postingType === "payment" && (
                  <Button 
                    onClick={async () => {
                      if (!ledgerAccount) {
                        toast.error("No active guest folio found");
                        return;
                      }

                      const amount = parseFloat(postingAmount);
                      if (isNaN(amount) || amount <= 0) {
                        toast.error("Please enter a valid amount");
                        return;
                      }

                      if (!postingDescription.trim()) {
                        toast.error("Please enter a description");
                        return;
                      }

                      setIsSaving(true);

                      try {
                        // Post the payment first
                        await handlePostManualCharge();

                        // Verify balance is now zero or less
                        const { data: updatedLedger } = await supabase
                          .from("ledger_accounts")
                          .select("balance")
                          .eq("id", ledgerAccount.id)
                          .single();

                        if (updatedLedger && updatedLedger.balance <= 0) {
                          // Balance is settled, proceed with checkout
                          if (checkoutCallback) {
                            await checkoutCallback();
                          }
                        } else {
                          toast.warning("Payment posted, but balance remains. Additional payment required.");
                        }
                      } catch (error) {
                        console.error("Error during payment and checkout:", error);
                        toast.error("Payment posted but checkout failed. Please try checkout again.");
                      } finally {
                        setIsSaving(false);
                        setPendingCheckout(false);
                        setCheckoutCallback(null);
                      }
                    }} 
                    disabled={isSaving}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <LogOut className="h-4 w-4 mr-2" />
                        Post & Check Out
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Transfer Balance Dialog */}
      <Dialog open={isTransferDialogOpen} onOpenChange={setIsTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {transferDirection === "advance_to_guest" 
                ? "Transfer Advance Deposit to Guest Folio" 
                : "Transfer Balance to City Ledger"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {transferDirection === "advance_to_guest" && advanceDeposit && (
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="text-sm text-muted-foreground">Available Advance Deposit</div>
                <div className="text-xl font-bold">${advanceDeposit.balance.toFixed(2)}</div>
              </div>
            )}

            {transferDirection === "guest_to_city" && ledgerAccount && (
              <>
                <div className="bg-muted/50 rounded-lg p-4">
                  <div className="text-sm text-muted-foreground">Guest Folio Balance</div>
                  <div className="text-xl font-bold">${displayBalance.toFixed(2)}</div>
                </div>

                <div>
                  <Label>City Ledger Account *</Label>
                  <Select value={selectedCityLedgerId} onValueChange={setSelectedCityLedgerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select city ledger account" />
                    </SelectTrigger>
                    <SelectContent>
                      {cityLedgers.map((ledger) => (
                        <SelectItem key={ledger.id} value={ledger.id}>
                          {ledger.company_name || ledger.contact_name || "Unknown"} - Balance: ${ledger.balance.toFixed(2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div>
              <Label>Transfer Amount *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max={transferDirection === "advance_to_guest" 
                  ? advanceDeposit?.balance 
                  : ledgerAccount?.balance}
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label>Description (optional)</Label>
              <Input
                value={transferDescription}
                onChange={(e) => setTransferDescription(e.target.value)}
                placeholder="Enter transfer description"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTransferDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleTransfer} disabled={isSaving}>
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ArrowRightLeft className="h-4 w-4 mr-2" />
                  Transfer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void Posting Confirmation Dialog */}
      <Dialog open={isVoidDialogOpen} onOpenChange={(open) => {
        setIsVoidDialogOpen(open);
        if (!open) setPostingToVoid(null);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Void Posting
            </DialogTitle>
          </DialogHeader>

          {postingToVoid && (
            <div className="space-y-4 py-4">
              <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
                <p className="text-sm text-destructive font-medium mb-2">
                  Are you sure you want to void this posting?
                </p>
                <p className="text-xs text-muted-foreground">
                  This will create a reversing entry to offset the original transaction. The original posting will be marked as voided.
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Type:</span>
                  <Badge className={getPostingBadgeColor(postingToVoid.posting_type)}>
                    {postingToVoid.posting_type}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Description:</span>
                  <span className="font-medium">{postingToVoid.description}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Amount:</span>
                  <span className="font-medium">
                    {(postingToVoid.debit_amount || 0) > 0 
                      ? `Debit: $${postingToVoid.debit_amount.toFixed(2)}`
                      : `Credit: $${postingToVoid.credit_amount.toFixed(2)}`
                    }
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Posted:</span>
                  <span>{format(parseISO(postingToVoid.created_at), "MM/dd/yyyy HH:mm")}</span>
                </div>
              </div>

              {/* Warning for credit card transactions */}
              {(postingToVoid.posting_type === "payment" || postingToVoid.posting_type === "refund") && (
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                  <p className="text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    <span>
                      <strong>Note:</strong> This only voids the folio posting. If this was a credit card transaction, you may need to process the card void/refund separately.
                    </span>
                  </p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsVoidDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleVoidPosting} 
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Voiding...
                </>
              ) : (
                <>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Void Posting
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <FolioPrintDialog
        open={isPrintDialogOpen}
        onOpenChange={setIsPrintDialogOpen}
        reservationId={reservationId}
        ledgerAccountId={ledgerAccount?.id}
        postings={postings as any}
        balance={ledgerAccount?.balance || 0}
        siteTerminology={terminology.site}
      />
    </Collapsible>

  );
});

FolioDetail.displayName = "FolioDetail";