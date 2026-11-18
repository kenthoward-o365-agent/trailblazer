import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Search, Printer, Mail } from "lucide-react";
import { formatLocalDate } from "@/lib/dateUtils";
import { useProperty } from "@/contexts/PropertyContext";

interface LedgerAccount {
  id: string;
  ledger_type: string;
  balance: number;
  is_active: boolean;
  opened_at: string;
  reservation_id: string | null;
  guest_id: string | null;
  reservations?: {
    confirmation_number: string;
    status: string;
    check_in_date: string;
    check_out_date: string;
    sites: {
      site_number: string;
    };
    guests: {
      first_name: string;
      last_name: string;
    };
  };
}

export const GuestLedger = () => {
  const { selectedProperty } = useProperty();
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ledger_accounts")
        .select(`
          *,
          reservations!ledger_accounts_reservation_id_fkey (
            confirmation_number,
            status,
            check_in_date,
            check_out_date,
            sites (
              site_number
            ),
            guests (
              first_name,
              last_name
            )
          )
        `)
        .eq("ledger_type", "guest")
        .eq("is_active", true)
        .order("opened_at", { ascending: false });

      if (error) throw error;
      // Filter to only show checked-in reservations
      const checkedInAccounts = (data || []).filter(
        (acc) => acc.reservations?.status === 'CHECKED_IN'
      );
      setAccounts(checkedInAccounts);
    } catch (error) {
      console.error("Error loading accounts:", error);
      toast.error("Failed to load guest ledger accounts");
    } finally {
      setLoading(false);
    }
  };

  const filteredAccounts = accounts.filter((account) => {
    if (!searchTerm) return true;
    const guestName = account.reservations?.guests
      ? `${account.reservations.guests.first_name} ${account.reservations.guests.last_name}`
      : "";
    const siteNumber = account.reservations?.sites?.site_number || "";
    const confirmationNumber = account.reservations?.confirmation_number || "";
    const search = searchTerm.toLowerCase();
    return (
      guestName.toLowerCase().includes(search) ||
      siteNumber.toLowerCase().includes(search) ||
      confirmationNumber.toLowerCase().includes(search)
    );
  });

  const totalBalance = filteredAccounts.reduce((sum, acc) => sum + acc.balance, 0);

  const handlePrint = () => {
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Guest Ledger Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { font-size: 24px; margin-bottom: 5px; }
          .subtitle { color: #666; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #f5f5f5; }
          .text-right { text-align: right; }
          .total-row { font-weight: bold; background-color: #f9f9f9; }
          .credit { color: #16a34a; }
          .debit { color: #dc2626; }
        </style>
      </head>
      <body>
        <h1>Guest Ledger Report</h1>
        <p class="subtitle">${selectedProperty?.name || 'Property'} - Generated: ${new Date().toLocaleDateString()}</p>
        <table>
          <thead>
            <tr>
              <th>Confirmation #</th>
              <th>Guest Name</th>
              <th>Site</th>
              <th>Check-in</th>
              <th>Check-out</th>
              <th class="text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            ${filteredAccounts.map(account => `
              <tr>
                <td>${account.reservations?.confirmation_number || '-'}</td>
                <td>${account.reservations?.guests ? `${account.reservations.guests.first_name} ${account.reservations.guests.last_name}` : 'Unknown Guest'}</td>
                <td>${account.reservations?.sites?.site_number || '-'}</td>
                <td>${account.reservations ? formatLocalDate(account.reservations.check_in_date, "MMM d, yyyy") : '-'}</td>
                <td>${account.reservations ? formatLocalDate(account.reservations.check_out_date, "MMM d, yyyy") : '-'}</td>
                <td class="text-right ${account.balance < 0 ? 'credit' : account.balance > 0 ? 'debit' : ''}">$${Math.abs(account.balance).toFixed(2)}${account.balance < 0 ? ' CR' : ''}</td>
              </tr>
            `).join('')}
            <tr class="total-row">
              <td colspan="5">Total</td>
              <td class="text-right ${totalBalance < 0 ? 'credit' : totalBalance > 0 ? 'debit' : ''}">$${Math.abs(totalBalance).toFixed(2)}${totalBalance < 0 ? ' CR' : ''}</td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const handleEmail = () => {
    toast.info("Email functionality coming soon");
  };

  return (
    <Card className="p-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-lg">Guest Ledger</h3>
          <Badge variant="secondary">{filteredAccounts.length} accounts</Badge>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none sm:w-64">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by confirmation #, guest, or site..."
              className="pl-9"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon" onClick={handlePrint}>
            <Printer className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={handleEmail}>
            <Mail className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Confirmation #</TableHead>
              <TableHead>Guest Name</TableHead>
              <TableHead>Site</TableHead>
              <TableHead>Check-in</TableHead>
              <TableHead>Check-out</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredAccounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No guest ledger accounts found
                </TableCell>
              </TableRow>
            ) : (
              <>
                {filteredAccounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-mono">
                      {account.reservations?.confirmation_number || "-"}
                    </TableCell>
                    <TableCell className="font-medium">
                      {account.reservations?.guests
                        ? `${account.reservations.guests.first_name} ${account.reservations.guests.last_name}`
                        : "Unknown Guest"}
                    </TableCell>
                    <TableCell>
                      {account.reservations?.sites?.site_number ? (
                        <Badge variant="outline">{account.reservations.sites.site_number}</Badge>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      {account.reservations
                        ? formatLocalDate(account.reservations.check_in_date, "MMM d, yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {account.reservations
                        ? formatLocalDate(account.reservations.check_out_date, "MMM d, yyyy")
                        : "-"}
                    </TableCell>
                    <TableCell className={`text-right font-medium ${
                      account.balance > 0 ? "text-destructive" : account.balance < 0 ? "text-primary" : ""
                    }`}>
                      ${Math.abs(account.balance).toFixed(2)}
                      {account.balance < 0 ? " CR" : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Total Summary */}
      {!loading && filteredAccounts.length > 0 && (
        <div className="flex justify-end mt-4 pt-4 border-t">
          <div className="text-right">
            <span className="text-muted-foreground mr-4">Total Balance:</span>
            <span className={`text-lg font-semibold ${
              totalBalance > 0 ? "text-destructive" : totalBalance < 0 ? "text-primary" : ""
            }`}>
              ${Math.abs(totalBalance).toFixed(2)}
              {totalBalance < 0 ? " CR" : ""}
            </span>
          </div>
        </div>
      )}
    </Card>
  );
};
