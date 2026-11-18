import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Banknote, CreditCard, DollarSign, ExternalLink, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuditDate } from "@/contexts/AuditDateContext";

interface Account {
  id: string;
  code: string;
  name: string;
  account_group_id: string;
  account_groups?: {
    name: string;
    account_type: string;
  };
}

interface GroupMasterDepositProps {
  groupBlockId: string;
  masterLedgerAccountId: string | null;
  propertyId: string;
  groupCode: string;
  onDepositPosted?: () => void;
}

export function GroupMasterDeposit({
  groupBlockId,
  masterLedgerAccountId,
  propertyId,
  groupCode,
  onDepositPosted,
}: GroupMasterDepositProps) {
  const navigate = useNavigate();
  const { auditDate } = useAuditDate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [paymentAccounts, setPaymentAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentBalance, setCurrentBalance] = useState<number>(0);

  useEffect(() => {
    loadPaymentAccounts();
    if (masterLedgerAccountId) {
      loadCurrentBalance();
    } else {
      setLoading(false);
    }
  }, [masterLedgerAccountId, propertyId]);

  const loadPaymentAccounts = async () => {
    const { data } = await supabase
      .from("accounts")
      .select(`
        id,
        code,
        name,
        account_group_id,
        account_groups (name, account_type)
      `)
      .eq("property_id", propertyId)
      .eq("is_active", true)
      .order("code");

    if (data) {
      const paymentAccountsFiltered = data.filter(
        (a) =>
          a.account_groups?.name === "Credit Card Payments" ||
          a.account_groups?.name === "Bank Payments"
      );
      setPaymentAccounts(paymentAccountsFiltered);

      if (paymentAccountsFiltered.length > 0) {
        setSelectedAccountId(paymentAccountsFiltered[0].id);
      }
    }
  };

  const loadCurrentBalance = async () => {
    if (!masterLedgerAccountId) return;
    
    const { data } = await supabase
      .from("ledger_accounts")
      .select("balance")
      .eq("id", masterLedgerAccountId)
      .maybeSingle();

    if (data) {
      setCurrentBalance(data.balance);
    }
    setLoading(false);
  };

  const handlePostPayment = async () => {
    const paymentAmount = parseFloat(amount);

    if (!paymentAmount || paymentAmount <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    if (!selectedAccountId) {
      toast.error("Please select a payment account");
      return;
    }

    if (!masterLedgerAccountId) {
      toast.error("Master ledger account not found. Please save the group block first.");
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

      const newBalance = currentBalance + paymentAmount;

      // Create folio posting
      const { error: postingError } = await supabase.from("folio_postings").insert({
        ledger_account_id: masterLedgerAccountId,
        posting_type: "payment",
        description: `Group Master Deposit (${groupCode}) - ${accountDescription}`,
        amount: paymentAmount,
        running_balance: newBalance,
        posting_date: auditDate,
        posted_by: user?.id,
        posted_by_name: staffName,
        account_id: selectedAccountId,
      });

      if (postingError) throw postingError;

      // Create ledger transaction
      await supabase.from("ledger_transactions").insert({
        ledger_account_id: masterLedgerAccountId,
        transaction_type: "payment",
        description: `Group Master Deposit Payment (${groupCode}) - ${accountDescription}`,
        debit_amount: paymentAmount,
        credit_amount: 0,
        posted_by_name: staffName,
        account_id: selectedAccountId,
        account_code: selectedAccount?.code,
      });

      // Update ledger account balance
      await supabase
        .from("ledger_accounts")
        .update({ balance: newBalance })
        .eq("id", masterLedgerAccountId);

      toast.success(`Deposit of $${paymentAmount.toFixed(2)} posted successfully`);

      setIsDialogOpen(false);
      setAmount("");
      setCurrentBalance(newBalance);

      onDepositPosted?.();
    } catch (error) {
      console.error("Error posting deposit:", error);
      toast.error("Failed to post deposit");
    } finally {
      setIsSaving(false);
    }
  };

  const handleViewFolio = () => {
    if (masterLedgerAccountId) {
      navigate(`/accounting/folio/${masterLedgerAccountId}`);
    }
  };

  // Group accounts by type
  const creditCardAccounts = paymentAccounts.filter(
    (a) => a.account_groups?.name === "Credit Card Payments"
  );
  const bankAccounts = paymentAccounts.filter(
    (a) => a.account_groups?.name === "Bank Payments"
  );

  if (!masterLedgerAccountId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            Master Account Deposits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            Save the group block to create the master ledger account and enable deposits.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            Master Account Deposits
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleViewFolio}>
              <ExternalLink className="h-4 w-4 mr-1" />
              View Folio
            </Button>
            <Button size="sm" onClick={() => setIsDialogOpen(true)}>
              <DollarSign className="h-4 w-4 mr-1" />
              Take Payment
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Current Balance</p>
              <p className={`text-2xl font-bold ${currentBalance > 0 ? "text-green-600" : ""}`}>
                ${currentBalance.toFixed(2)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Record Master Account Deposit</DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Amount Input */}
            <div className="space-y-2">
              <Label className="text-base font-medium">Payment Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="pl-8 text-lg"
                />
              </div>
            </div>

            {/* Payment Account Selection */}
            <div className="space-y-3">
              <Label className="text-base font-medium">Payment Method</Label>
              <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select payment account" />
                </SelectTrigger>
                <SelectContent>
                  {creditCardAccounts.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Credit Card Payments
                      </div>
                      {creditCardAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.code} - {account.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {bankAccounts.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground flex items-center gap-2 mt-2">
                        <Banknote className="h-4 w-4" />
                        Bank Payments
                      </div>
                      {bankAccounts.map((account) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.code} - {account.name}
                        </SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Summary */}
            <div className="rounded-lg bg-muted p-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Amount to Collect:</span>
                <span className="text-xl font-bold text-primary">
                  ${parseFloat(amount || "0").toFixed(2)}
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
            <Button
              onClick={handlePostPayment}
              disabled={isSaving || !amount || parseFloat(amount) <= 0}
            >
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
