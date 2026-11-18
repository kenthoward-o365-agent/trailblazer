import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format, differenceInDays } from "date-fns";
import { FileText, ExternalLink } from "lucide-react";

export interface CityLedgerInvoice {
  id: string;
  city_ledger_account_id: string;
  source_folio_id: string | null;
  reservation_id: string | null;
  confirmation_number: string | null;
  guest_name: string | null;
  room_number: string | null;
  checkout_date: string | null;
  transfer_date: string;
  original_amount: number;
  paid_amount: number;
  status: "open" | "partial" | "paid";
  notes: string | null;
  property_id: string;
  created_at: string;
}

interface CityLedgerInvoicesProps {
  invoices: CityLedgerInvoice[];
  onViewFolio?: (reservationId: string) => void;
}

export function CityLedgerInvoices({ invoices, onViewFolio }: CityLedgerInvoicesProps) {
  const [filter, setFilter] = useState<"all" | "open" | "partial" | "paid">("open");

  const filteredInvoices = invoices.filter((inv) => {
    if (filter === "all") return true;
    return inv.status === filter;
  });

  const getAgeDays = (transferDate: string) => {
    return differenceInDays(new Date(), new Date(transferDate));
  };

  const getAgeBadge = (days: number) => {
    if (days <= 30) return <Badge variant="secondary">{days}d</Badge>;
    if (days <= 60) return <Badge className="bg-yellow-500/10 text-yellow-700">{days}d</Badge>;
    if (days <= 90) return <Badge className="bg-orange-500/10 text-orange-700">{days}d</Badge>;
    return <Badge variant="destructive">{days}d</Badge>;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "open":
        return <Badge variant="destructive">Open</Badge>;
      case "partial":
        return <Badge className="bg-yellow-500/10 text-yellow-700">Partial</Badge>;
      case "paid":
        return <Badge className="bg-green-500/10 text-green-700">Paid</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getBalance = (invoice: CityLedgerInvoice) => {
    return invoice.original_amount - invoice.paid_amount;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">Invoices</h3>
          <Badge variant="outline">{filteredInvoices.length}</Badge>
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open Only</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredInvoices.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No {filter === "all" ? "" : filter} invoices found
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Conf #</TableHead>
                <TableHead>Guest</TableHead>
                <TableHead>Room</TableHead>
                <TableHead>Transfer Date</TableHead>
                <TableHead className="text-right">Original</TableHead>
                <TableHead className="text-right">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead>Age</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredInvoices.map((invoice) => {
                const balance = getBalance(invoice);
                const ageDays = getAgeDays(invoice.transfer_date);
                
                return (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono text-sm">
                      {invoice.confirmation_number || "-"}
                    </TableCell>
                    <TableCell>{invoice.guest_name || "-"}</TableCell>
                    <TableCell>{invoice.room_number || "-"}</TableCell>
                    <TableCell>
                      {format(new Date(invoice.transfer_date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${invoice.original_amount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      ${invoice.paid_amount.toFixed(2)}
                    </TableCell>
                    <TableCell className={`text-right font-bold ${balance > 0 ? "text-red-600" : "text-green-600"}`}>
                      ${balance.toFixed(2)}
                    </TableCell>
                    <TableCell>{getAgeBadge(ageDays)}</TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell>
                      {invoice.reservation_id && onViewFolio && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onViewFolio(invoice.reservation_id!)}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Summary */}
      <div className="flex justify-end gap-8 text-sm border-t pt-4">
        <div>
          <span className="text-muted-foreground">Total Original: </span>
          <span className="font-semibold">
            ${filteredInvoices.reduce((sum, inv) => sum + inv.original_amount, 0).toFixed(2)}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Total Paid: </span>
          <span className="font-semibold text-green-600">
            ${filteredInvoices.reduce((sum, inv) => sum + inv.paid_amount, 0).toFixed(2)}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Total Balance: </span>
          <span className="font-bold text-red-600">
            ${filteredInvoices.reduce((sum, inv) => sum + (inv.original_amount - inv.paid_amount), 0).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}
