import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { format, differenceInDays } from "date-fns";
import { Printer, Mail, Loader2, FileText } from "lucide-react";
import { CityLedgerInvoice } from "./CityLedgerInvoices";
import { useProperty } from "@/contexts/PropertyContext";

interface LedgerAccount {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  street_address?: string | null;
  street_address_2?: string | null;
  city?: string | null;
  state?: string | null;
  zipcode?: string | null;
  phone?: string | null;
  account_number?: string | null;
  payment_terms_days?: number;
  balance: number;
}

interface CityLedgerStatementProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: LedgerAccount;
  invoices: CityLedgerInvoice[];
}

export function CityLedgerStatement({
  open,
  onOpenChange,
  account,
  invoices,
}: CityLedgerStatementProps) {
  const { selectedProperty } = useProperty();
  const [emailTo, setEmailTo] = useState(account.contact_email || "");
  const [isSending, setIsSending] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const openInvoices = invoices.filter((inv) => inv.status !== "paid");
  const totalBalance = openInvoices.reduce(
    (sum, inv) => sum + (inv.original_amount - inv.paid_amount),
    0
  );

  // Calculate aging
  const aging = {
    current: 0,
    days30: 0,
    days60: 0,
    days90: 0,
    over90: 0,
  };

  openInvoices.forEach((inv) => {
    const balance = inv.original_amount - inv.paid_amount;
    const days = differenceInDays(new Date(), new Date(inv.transfer_date));
    
    if (days <= 0) aging.current += balance;
    else if (days <= 30) aging.days30 += balance;
    else if (days <= 60) aging.days60 += balance;
    else if (days <= 90) aging.days90 += balance;
    else aging.over90 += balance;
  });

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow popups to print");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Statement - ${account.company_name || account.contact_name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f5f5f5; }
            .text-right { text-align: right; }
            .header { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .summary { background: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; }
            .aging { display: flex; gap: 20px; margin: 20px 0; }
            .aging-item { text-align: center; padding: 10px; background: #f5f5f5; border-radius: 5px; }
            h1 { margin: 0; color: #333; }
            .balance { font-size: 24px; font-weight: bold; color: #c00; }
            @media print { body { margin: 20px; } }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleEmail = async () => {
    if (!emailTo) {
      toast.error("Please enter an email address");
      return;
    }

    setIsSending(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const senderName = user?.user_metadata?.first_name 
        ? `${user.user_metadata.first_name} ${user.user_metadata.last_name || ''}`
        : 'Staff';

      const statementHtml = printRef.current?.innerHTML || "";

      const { data, error } = await supabase.functions.invoke("send-statement", {
        body: {
          cityLedgerAccountId: account.id,
          recipientEmail: emailTo,
          statementHtml: `
            <!DOCTYPE html>
            <html>
              <head>
                <style>
                  body { font-family: Arial, sans-serif; margin: 20px; }
                  table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                  th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                  th { background-color: #f5f5f5; }
                  .text-right { text-align: right; }
                  .summary { background: #f9f9f9; padding: 15px; border-radius: 5px; }
                </style>
              </head>
              <body>
                ${statementHtml}
              </body>
            </html>
          `,
          propertyId: selectedProperty?.id,
          totalAmount: totalBalance,
          senderName,
          propertyName: selectedProperty?.name,
        },
      });

      if (error) throw error;

      if (data.mock) {
        toast.success("Statement logged (mock mode - add RESEND_API_KEY for real emails)");
      } else {
        toast.success("Statement sent successfully!");
      }
    } catch (error) {
      console.error("Error sending statement:", error);
      toast.error("Failed to send statement");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Statement of Account
          </DialogTitle>
        </DialogHeader>

        {/* Statement Content */}
        <div ref={printRef} className="bg-white p-6">
          {/* Header */}
          <div className="flex justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {selectedProperty?.name || "Property"}
              </h1>
              <p className="text-sm text-muted-foreground">{selectedProperty?.address}</p>
              <p className="text-sm text-muted-foreground">{selectedProperty?.phone1}</p>
            </div>
            <div className="text-right">
              <h2 className="text-xl font-semibold">STATEMENT</h2>
              <p className="text-sm text-muted-foreground">
                Date: {format(new Date(), "MMMM d, yyyy")}
              </p>
            </div>
          </div>

          {/* Customer Info */}
          <div className="border rounded-lg p-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Bill To:</p>
                <p className="font-semibold">{account.company_name || account.contact_name}</p>
                {account.street_address && <p className="text-sm">{account.street_address}</p>}
                {account.street_address_2 && <p className="text-sm">{account.street_address_2}</p>}
                {(account.city || account.state || account.zipcode) && (
                  <p className="text-sm">
                    {[account.city, account.state, account.zipcode].filter(Boolean).join(", ")}
                  </p>
                )}
              </div>
              <div className="text-right">
                {account.account_number && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Account #:</span> {account.account_number}
                  </p>
                )}
                <p className="text-sm">
                  <span className="text-muted-foreground">Terms:</span> Net {account.payment_terms_days || 30}
                </p>
              </div>
            </div>
          </div>

          {/* Balance Summary */}
          <div className="bg-muted/30 rounded-lg p-4 mb-6 text-center">
            <p className="text-muted-foreground">Amount Due</p>
            <p className={`text-3xl font-bold ${totalBalance > 0 ? "text-destructive" : "text-green-600"}`}>
              ${totalBalance.toFixed(2)}
            </p>
          </div>

          {/* Aging Summary */}
          <div className="grid grid-cols-5 gap-2 mb-6">
            <div className="text-center p-3 bg-green-50 rounded">
              <p className="text-xs text-muted-foreground">Current</p>
              <p className="font-semibold">${aging.current.toFixed(2)}</p>
            </div>
            <div className="text-center p-3 bg-yellow-50 rounded">
              <p className="text-xs text-muted-foreground">1-30 Days</p>
              <p className="font-semibold">${aging.days30.toFixed(2)}</p>
            </div>
            <div className="text-center p-3 bg-orange-50 rounded">
              <p className="text-xs text-muted-foreground">31-60 Days</p>
              <p className="font-semibold">${aging.days60.toFixed(2)}</p>
            </div>
            <div className="text-center p-3 bg-red-50 rounded">
              <p className="text-xs text-muted-foreground">61-90 Days</p>
              <p className="font-semibold">${aging.days90.toFixed(2)}</p>
            </div>
            <div className="text-center p-3 bg-red-100 rounded">
              <p className="text-xs text-muted-foreground">Over 90</p>
              <p className="font-semibold">${aging.over90.toFixed(2)}</p>
            </div>
          </div>

          {/* Invoice Details */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Conf #</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {openInvoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>
                    {format(new Date(invoice.transfer_date), "MM/dd/yyyy")}
                  </TableCell>
                  <TableCell className="font-mono">
                    {invoice.confirmation_number || "-"}
                  </TableCell>
                  <TableCell>{invoice.guest_name || "-"}</TableCell>
                  <TableCell>
                    Room {invoice.room_number || "-"}
                    {invoice.checkout_date && ` (CO: ${format(new Date(invoice.checkout_date), "MM/dd")})`}
                  </TableCell>
                  <TableCell className="text-right">
                    ${invoice.original_amount.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right text-green-600">
                    ${invoice.paid_amount.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    ${(invoice.original_amount - invoice.paid_amount).toFixed(2)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold">
                <TableCell colSpan={6} className="text-right">
                  Total Due:
                </TableCell>
                <TableCell className="text-right text-lg">
                  ${totalBalance.toFixed(2)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t text-sm text-muted-foreground text-center">
            <p>Thank you for your business.</p>
            <p>Please remit payment to the address above.</p>
            <p>For questions, contact us at {selectedProperty?.email || selectedProperty?.phone1}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="border-t pt-4 space-y-4">
          <div className="flex items-end gap-4">
            <div className="flex-1">
              <Label>Email Statement To</Label>
              <Input
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                placeholder="email@company.com"
              />
            </div>
            <Button onClick={handleEmail} disabled={isSending || !emailTo}>
              {isSending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              Send Email
            </Button>
          </div>
          
          <div className="flex justify-end">
            <Badge variant="outline" className="text-xs">
              Email sends in mock mode until RESEND_API_KEY is configured
            </Badge>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <Button onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Print Statement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
