import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle, CreditCard, ArrowRightLeft, UserX } from "lucide-react";
import { useProperty } from "@/contexts/PropertyContext";
import { useAuditDate } from "@/contexts/AuditDateContext";

interface CancellationBalanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reservationId: string;
  guestName: string;
  depositBalance: number;
  depositAccountId: string;
  mode: "cancel" | "no_show";
  onComplete: () => void;
}

interface TransferTarget {
  id: string;
  confirmation_number: string;
  guest_name: string;
  check_in_date: string;
}

export function CancellationBalanceDialog({
  open,
  onOpenChange,
  reservationId,
  guestName,
  depositBalance,
  depositAccountId,
  mode,
  onComplete,
}: CancellationBalanceDialogProps) {
  const { selectedProperty } = useProperty();
  const { auditDate } = useAuditDate();
  const [selectedOption, setSelectedOption] = useState<string>("refund");
  const [processing, setProcessing] = useState(false);
  const [transferTargets, setTransferTargets] = useState<TransferTarget[]>([]);
  const [selectedTarget, setSelectedTarget] = useState<string>("");
  const [noShowFee, setNoShowFee] = useState<string>(depositBalance.toFixed(2));

  useEffect(() => {
    if (open && selectedProperty?.id) {
      loadTransferTargets();
    }
  }, [open, selectedProperty?.id]);

  const loadTransferTargets = async () => {
    if (!selectedProperty?.id) return;

    // Load other reservations that could receive the deposit transfer
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
      .order("check_in_date", { ascending: true })
      .limit(50);

    if (data) {
      setTransferTargets(
        data.map((r: any) => ({
          id: r.id,
          confirmation_number: r.confirmation_number,
          guest_name: `${r.guests?.first_name || ""} ${r.guests?.last_name || ""}`.trim(),
          check_in_date: r.check_in_date,
        }))
      );
    }
  };

  const handleRefund = async () => {
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const staffName = user?.user_metadata?.first_name
        ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ""}`
        : "Staff";

      // Get current running balance
      const { data: lastPosting } = await supabase
        .from("folio_postings")
        .select("running_balance")
        .eq("ledger_account_id", depositAccountId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const currentBalance = lastPosting?.running_balance || depositBalance;
      const newBalance = currentBalance - depositBalance;

      // Post refund to close the deposit account
      await supabase.from("folio_postings").insert({
        ledger_account_id: depositAccountId,
        posting_type: "refund",
        description: `Deposit refund - ${mode === "no_show" ? "No Show" : "Cancellation"}`,
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

      // Update reservation status
      await supabase
        .from("reservations")
        .update({ status: mode === "no_show" ? "NO_SHOW" : "CANCELLED" })
        .eq("id", reservationId);

      toast.success(`Deposit refunded and reservation ${mode === "no_show" ? "marked as no-show" : "cancelled"}`);
      onComplete();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(`Failed to process refund: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleTransfer = async () => {
    if (!selectedTarget) {
      toast.error("Please select a reservation to transfer to");
      return;
    }

    setProcessing(true);
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
        // Create new advance deposit account for target
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

      // Post debit to source account (close it out)
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
        description: `Transfer to reservation - ${mode === "no_show" ? "No Show" : "Cancellation"}`,
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
        description: `Transfer from cancelled reservation`,
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

      // Update original reservation status
      await supabase
        .from("reservations")
        .update({ status: mode === "no_show" ? "NO_SHOW" : "CANCELLED" })
        .eq("id", reservationId);

      toast.success(`Deposit transferred and reservation ${mode === "no_show" ? "marked as no-show" : "cancelled"}`);
      onComplete();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(`Failed to transfer deposit: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleChargeNoShow = async () => {
    setProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const staffName = user?.user_metadata?.first_name
        ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ""}`
        : "Staff";

      const fee = parseFloat(noShowFee) || 0;

      // Create guest ledger account for the no-show
      const { data: guestAccount, error: guestError } = await supabase
        .from("ledger_accounts")
        .insert({
          property_id: selectedProperty?.id,
          ledger_type: "guest",
          reservation_id: reservationId,
          balance: 0,
        })
        .select()
        .single();

      if (guestError) throw guestError;

      // Transfer deposit from advance deposit to guest ledger
      const { data: sourceLastPosting } = await supabase
        .from("folio_postings")
        .select("running_balance")
        .eq("ledger_account_id", depositAccountId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const sourceBalance = sourceLastPosting?.running_balance || depositBalance;

      // Post transfer out from advance deposit
      await supabase.from("folio_postings").insert({
        ledger_account_id: depositAccountId,
        posting_type: "transfer_out",
        description: "Transfer to guest folio - No Show",
        amount: depositBalance,
        debit_amount: depositBalance,
        credit_amount: 0,
        running_balance: sourceBalance - depositBalance,
        posting_date: auditDate,
        posted_by: user?.id,
        posted_by_name: staffName,
      });

      // Close advance deposit account
      await supabase
        .from("ledger_accounts")
        .update({ is_active: false, balance: 0 })
        .eq("id", depositAccountId);

      // Post deposit credit to guest folio
      await supabase.from("folio_postings").insert({
        ledger_account_id: guestAccount.id,
        posting_type: "payment",
        description: "Advance deposit applied",
        amount: depositBalance,
        debit_amount: 0,
        credit_amount: depositBalance,
        running_balance: -depositBalance, // Credit balance
        posting_date: auditDate,
        posted_by: user?.id,
        posted_by_name: staffName,
      });

      // Post no-show charge to guest folio
      if (fee > 0) {
        await supabase.from("folio_postings").insert({
          ledger_account_id: guestAccount.id,
          posting_type: "charge",
          description: "No-Show Fee",
          amount: fee,
          debit_amount: fee,
          credit_amount: 0,
          running_balance: fee - depositBalance,
          posting_date: auditDate,
          posted_by: user?.id,
          posted_by_name: staffName,
        });
      }

      // Update guest account balance
      const finalBalance = fee - depositBalance;
      await supabase
        .from("ledger_accounts")
        .update({ balance: finalBalance })
        .eq("id", guestAccount.id);

      // Update reservation status to NO_SHOW
      await supabase
        .from("reservations")
        .update({ status: "NO_SHOW" })
        .eq("id", reservationId);

      toast.success("No-show processed with charges posted to guest folio");
      onComplete();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(`Failed to process no-show: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleSubmit = () => {
    switch (selectedOption) {
      case "refund":
        handleRefund();
        break;
      case "transfer":
        handleTransfer();
        break;
      case "charge":
        handleChargeNoShow();
        break;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            {mode === "no_show" ? "Process No-Show" : "Handle Deposit Balance"}
          </DialogTitle>
          <DialogDescription>
            {guestName} has an advance deposit of{" "}
            <span className="font-semibold text-foreground">
              ${depositBalance.toFixed(2)}
            </span>
            . Choose how to handle this balance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <RadioGroup value={selectedOption} onValueChange={setSelectedOption}>
            <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="refund" id="refund" className="mt-1" />
              <Label htmlFor="refund" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  <span className="font-medium">Refund Deposit</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Process a refund of ${depositBalance.toFixed(2)} to the guest
                </p>
              </Label>
            </div>

            <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="transfer" id="transfer" className="mt-1" />
              <Label htmlFor="transfer" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2">
                  <ArrowRightLeft className="h-4 w-4" />
                  <span className="font-medium">Transfer to Another Reservation</span>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Move the deposit to a different reservation
                </p>
              </Label>
            </div>

            {mode === "no_show" && (
              <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                <RadioGroupItem value="charge" id="charge" className="mt-1" />
                <Label htmlFor="charge" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <UserX className="h-4 w-4" />
                    <span className="font-medium">Charge as No-Show</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create guest folio with no-show charges
                  </p>
                </Label>
              </div>
            )}
          </RadioGroup>

          {selectedOption === "transfer" && (
            <div className="space-y-2">
              <Label>Transfer to Reservation</Label>
              <Select value={selectedTarget} onValueChange={setSelectedTarget}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a reservation..." />
                </SelectTrigger>
                <SelectContent>
                  {transferTargets.length === 0 ? (
                    <SelectItem value="none" disabled>
                      No eligible reservations found
                    </SelectItem>
                  ) : (
                    transferTargets.map((target) => (
                      <SelectItem key={target.id} value={target.id}>
                        #{target.confirmation_number} - {target.guest_name} (
                        {new Date(target.check_in_date).toLocaleDateString()})
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedOption === "charge" && (
            <div className="space-y-2">
              <Label>No-Show Fee Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={noShowFee}
                  onChange={(e) => setNoShowFee(e.target.value)}
                  className="pl-7"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Typically one night's rate. Deposit will offset this charge.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={processing}>
            {processing ? "Processing..." : mode === "no_show" ? "Process No-Show" : "Proceed"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}