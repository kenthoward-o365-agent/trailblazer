import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { format } from "date-fns";
import { Loader2, CreditCard } from "lucide-react";
import { CityLedgerInvoice } from "./CityLedgerInvoices";
import { useAuditDate } from "@/contexts/AuditDateContext";

interface LedgerAccount {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  balance: number;
}

interface CityLedgerPaymentProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: LedgerAccount | null;
  invoices: CityLedgerInvoice[];
  onComplete: () => void;
}

interface InvoiceApplication {
  invoiceId: string;
  amount: number;
  maxAmount: number;
}

export function CityLedgerPayment({
  open,
  onOpenChange,
  account,
  invoices,
  onComplete,
}: CityLedgerPaymentProps) {
  const { auditDate } = useAuditDate();
  const accountId = account?.id || "";
  const accountName = account?.company_name || "Unknown";
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [autoApply, setAutoApply] = useState(true);
  const [applications, setApplications] = useState<InvoiceApplication[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const openInvoices = invoices
    .filter((inv) => inv.status !== "paid")
    .sort((a, b) => new Date(a.transfer_date).getTime() - new Date(b.transfer_date).getTime());

  useEffect(() => {
    // Initialize applications when dialog opens
    if (open) {
      setApplications(
        openInvoices.map((inv) => ({
          invoiceId: inv.id,
          amount: 0,
          maxAmount: inv.original_amount - inv.paid_amount,
        }))
      );
    }
  }, [open, invoices]);

  useEffect(() => {
    // Auto-apply payment amount to invoices (FIFO)
    if (autoApply && paymentAmount) {
      const amount = parseFloat(paymentAmount) || 0;
      let remaining = amount;
      
      const newApplications = openInvoices.map((inv) => {
        const balance = inv.original_amount - inv.paid_amount;
        const applyAmount = Math.min(remaining, balance);
        remaining -= applyAmount;
        
        return {
          invoiceId: inv.id,
          amount: applyAmount,
          maxAmount: balance,
        };
      });
      
      setApplications(newApplications);
    }
  }, [paymentAmount, autoApply]);

  const totalApplied = applications.reduce((sum, app) => sum + app.amount, 0);
  const unapplied = (parseFloat(paymentAmount) || 0) - totalApplied;

  const handleApplicationChange = (invoiceId: string, value: string) => {
    const amount = parseFloat(value) || 0;
    setApplications((prev) =>
      prev.map((app) =>
        app.invoiceId === invoiceId
          ? { ...app, amount: Math.min(amount, app.maxAmount) }
          : app
      )
    );
    setAutoApply(false);
  };

  const handleSubmit = async () => {
    const amount = parseFloat(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    if (totalApplied > amount) {
      toast.error("Applied amount exceeds payment amount");
      return;
    }

    setIsSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const staffName = user?.user_metadata?.first_name 
        ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`
        : 'Staff';

      // Get current account balance
      const { data: account } = await supabase
        .from("ledger_accounts")
        .select("balance")
        .eq("id", accountId)
        .single();

      if (!account) throw new Error("Account not found");

      // Create payment transaction
      const { data: transaction, error: txError } = await supabase
        .from("ledger_transactions")
        .insert({
          ledger_account_id: accountId,
          transaction_type: "payment",
          description: paymentReference || "Payment received",
          credit_amount: amount,
          debit_amount: 0,
          posted_by_name: staffName,
          reference_number: paymentReference || null,
        })
        .select()
        .single();

      if (txError) throw txError;

      // Create folio posting
      await supabase.from("folio_postings").insert({
        ledger_account_id: accountId,
        posting_type: "payment",
        description: paymentReference || "Payment received",
        amount: -amount,
        debit_amount: 0,
        credit_amount: amount,
        running_balance: account.balance - amount,
        posting_date: auditDate,
        posted_by: user?.id,
        posted_by_name: staffName,
      });

      // Update account balance
      await supabase
        .from("ledger_accounts")
        .update({ balance: account.balance - amount })
        .eq("id", accountId);

      // Apply to invoices
      for (const app of applications) {
        if (app.amount <= 0) continue;

        // Create invoice payment record
        await supabase.from("city_ledger_invoice_payments").insert({
          invoice_id: app.invoiceId,
          payment_transaction_id: transaction.id,
          applied_amount: app.amount,
          applied_by_name: staffName,
        });

        // Update invoice
        const invoice = openInvoices.find((inv) => inv.id === app.invoiceId);
        if (invoice) {
          const newPaidAmount = invoice.paid_amount + app.amount;
          const newStatus = 
            newPaidAmount >= invoice.original_amount ? "paid" : 
            newPaidAmount > 0 ? "partial" : "open";

          await supabase
            .from("city_ledger_invoices")
            .update({
              paid_amount: newPaidAmount,
              status: newStatus,
            })
            .eq("id", app.invoiceId);
        }
      }

      toast.success(`Payment of $${amount.toFixed(2)} posted successfully`);
      onOpenChange(false);
      setPaymentAmount("");
      setPaymentReference("");
      setAutoApply(true);
      onComplete();
    } catch (error) {
      console.error("Error posting payment:", error);
      toast.error("Failed to post payment");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Post Payment - {accountName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Payment Amount *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div>
              <Label>Reference / Check #</Label>
              <Input
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                placeholder="Optional reference"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="autoApply"
              checked={autoApply}
              onCheckedChange={(checked) => setAutoApply(checked === true)}
            />
            <Label htmlFor="autoApply" className="text-sm cursor-pointer">
              Auto-apply to oldest invoices first (FIFO)
            </Label>
          </div>

          {openInvoices.length > 0 && (
            <div>
              <Label className="mb-2 block">Apply to Invoices</Label>
              <div className="border rounded-lg overflow-hidden max-h-[300px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Conf #</TableHead>
                      <TableHead>Guest</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead className="text-right">Apply</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openInvoices.map((invoice) => {
                      const balance = invoice.original_amount - invoice.paid_amount;
                      const app = applications.find((a) => a.invoiceId === invoice.id);
                      
                      return (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-mono text-sm">
                            {invoice.confirmation_number || "-"}
                          </TableCell>
                          <TableCell>{invoice.guest_name || "-"}</TableCell>
                          <TableCell>
                            {format(new Date(invoice.transfer_date), "MM/dd/yy")}
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ${balance.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              max={balance}
                              value={app?.amount || ""}
                              onChange={(e) => handleApplicationChange(invoice.id, e.target.value)}
                              className="w-24 text-right"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Payment Amount:</span>
              <span className="font-semibold">${(parseFloat(paymentAmount) || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Applied to Invoices:</span>
              <span className="font-semibold text-green-600">${totalApplied.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm border-t pt-2">
              <span>Unapplied:</span>
              <span className={`font-semibold ${unapplied > 0 ? "text-yellow-600" : ""}`}>
                ${unapplied.toFixed(2)}
              </span>
            </div>
            {unapplied > 0 && (
              <p className="text-xs text-muted-foreground">
                Unapplied amount will create a credit on the account
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving || !paymentAmount}>
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Posting...
              </>
            ) : (
              <>
                <CreditCard className="h-4 w-4 mr-2" />
                Post Payment
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
