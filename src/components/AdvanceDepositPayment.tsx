import { useEffect, useState } from "react";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Banknote, CreditCard, DollarSign, Loader2 } from "lucide-react";
import { getRevenueAccountTaxes, calculateTaxes, getTotalTaxAmount } from "@/lib/taxCalculations";
import { useAuditDate } from "@/contexts/AuditDateContext";

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

interface AdvanceDepositPaymentProps {
  reservationId: string;
  totalCharges: number;
  firstNightRate: number;
  numberOfNights: number;
  numberOfAdults: number;
  revenueAccountId?: string | null;
  guestId: string;
  propertyId: string;
  defaultDepositRequirement?: string;
  onPaymentPosted?: () => void;
}

export function AdvanceDepositPayment({
  reservationId,
  totalCharges,
  firstNightRate,
  numberOfNights,
  numberOfAdults,
  revenueAccountId,
  guestId,
  propertyId,
  defaultDepositRequirement,
  onPaymentPosted,
}: AdvanceDepositPaymentProps) {
  // Map deposit requirement to amount option
  const getInitialAmountOption = () => {
    switch (defaultDepositRequirement) {
      case "100_percent": return "100";
      case "50_percent": return "50";
      case "first_night_tax": return "first_night";
      default: return "100"; // Default to 100% when dialog opens
    }
  };

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [paymentAccounts, setPaymentAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [amountOption, setAmountOption] = useState(getInitialAmountOption());
  const [customAmount, setCustomAmount] = useState("");
  const [firstNightWithTax, setFirstNightWithTax] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [existingDeposit, setExistingDeposit] = useState<number>(0);
  const [paymentCards, setPaymentCards] = useState<PaymentCard[]>([]);
  const { auditDate } = useAuditDate();

  useEffect(() => {
    loadPaymentAccounts();
    loadExistingDeposit();
    calculateFirstNightWithTax();
    loadPaymentCards();
  }, [reservationId, revenueAccountId]);

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
    setLoading(false);
  };

  const loadPaymentCards = async () => {
    const { data } = await supabase
      .from('payment_cards')
      .select('id, card_brand, last_four_digits, cardholder_name, is_primary')
      .eq('reservation_id', reservationId)
      .order('is_primary', { ascending: false });
    
    setPaymentCards(data || []);
  };

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

  // Get the primary or first card on file
  const cardOnFile = paymentCards.find(c => c.is_primary) || paymentCards[0] || null;

  // Pre-select account based on card on file when dialog opens
  useEffect(() => {
    if (isDialogOpen && cardOnFile && paymentAccounts.length > 0) {
      const accountId = getAccountForCardBrand(cardOnFile.card_brand);
      if (accountId) {
        setSelectedAccountId(accountId);
      } else if (paymentAccounts.length > 0 && !selectedAccountId) {
        setSelectedAccountId(paymentAccounts[0].id);
      }
    } else if (isDialogOpen && paymentAccounts.length > 0 && !selectedAccountId) {
      setSelectedAccountId(paymentAccounts[0].id);
    }
  }, [isDialogOpen, cardOnFile, paymentAccounts]);

  const loadExistingDeposit = async () => {
    const { data } = await supabase
      .from("ledger_accounts")
      .select("balance")
      .eq("reservation_id", reservationId)
      .eq("ledger_type", "advance_deposit")
      .maybeSingle();

    if (data) {
      setExistingDeposit(data.balance);
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

      // Get the selected account details for description
      const selectedAccount = paymentAccounts.find((a) => a.id === selectedAccountId);
      const accountDescription = selectedAccount
        ? `${selectedAccount.code} - ${selectedAccount.name}`
        : "Payment";

      // Check if advance deposit ledger exists
      let { data: advanceLedger } = await supabase
        .from("ledger_accounts")
        .select("*")
        .eq("reservation_id", reservationId)
        .eq("ledger_type", "advance_deposit")
        .maybeSingle();

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

        if (createError) {
          throw createError;
        }
        advanceLedger = newLedger;
      }

      // Calculate new balance
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
      
      setIsDialogOpen(false);
      setAmountOption("100");
      setCustomAmount("");
      setExistingDeposit(newBalance);
      
      if (onPaymentPosted) {
        onPaymentPosted();
      }
    } catch (error) {
      console.error("Error posting advance deposit:", error);
      toast.error("Failed to post advance deposit");
    } finally {
      setIsSaving(false);
    }
  };

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
      <Card className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Banknote className="h-4 w-4 text-primary" />
            <div>
              <h3 className="text-sm font-semibold">Advance Deposit</h3>
              {existingDeposit > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Balance: <span className="text-green-600 font-medium">${existingDeposit.toFixed(2)}</span>
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">No deposit on file</p>
              )}
            </div>
          </div>
          <Button size="sm" onClick={() => setIsDialogOpen(true)}>
            <DollarSign className="h-3 w-3 mr-1" />
            Take Payment
          </Button>
        </div>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Advance Deposit Payment</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Amount Selection */}
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

            {/* Payment Account Selection */}
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

            {/* Summary */}
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
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
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
    </>
  );
}
