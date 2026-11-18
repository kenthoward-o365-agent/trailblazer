import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useProperty } from "@/contexts/PropertyContext";
import { toast } from "sonner";
import { Printer, Download, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import ExcelJS from "exceljs";

interface AccountBalance {
  id: string;
  code: string;
  name: string;
  groupName: string;
  groupType: string;
  normalBalance: string;
  debitBalance: number;
  creditBalance: number;
}

interface TrialBalanceProps {
  asOfDate?: string;
  compact?: boolean;
  showActions?: boolean;
  onBalanceCheck?: (isBalanced: boolean) => void;
}

export const TrialBalance = ({ 
  asOfDate, 
  compact = false, 
  showActions = true,
  onBalanceCheck 
}: TrialBalanceProps) => {
  const { selectedProperty } = useProperty();
  const [accounts, setAccounts] = useState<AccountBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalDebits, setTotalDebits] = useState(0);
  const [totalCredits, setTotalCredits] = useState(0);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedProperty?.id) {
      loadTrialBalance();
    }
  }, [selectedProperty?.id, asOfDate]);

  const loadTrialBalance = async () => {
    if (!selectedProperty?.id) return;
    
    setLoading(true);
    try {
      // Get all accounts with their groups
      const { data: accountsData, error: accountsError } = await supabase
        .from("accounts")
        .select(`
          id,
          code,
          name,
          normal_balance,
          account_groups!inner (
            id,
            name,
            account_type
          )
        `)
        .eq("property_id", selectedProperty.id)
        .eq("is_active", true)
        .order("code");

      if (accountsError) throw accountsError;

      // Calculate balances from journal entry lines
      const { data: journalLines, error: journalError } = await supabase
        .from("journal_entry_lines")
        .select(`
          account_id,
          debit_amount,
          credit_amount,
          journal_entries!inner (
            entry_date,
            is_posted,
            property_id
          )
        `)
        .eq("journal_entries.property_id", selectedProperty.id)
        .eq("journal_entries.is_posted", true);

      if (journalError) throw journalError;

      // Filter by date if provided
      const filteredLines = asOfDate 
        ? journalLines?.filter(line => (line.journal_entries as any).entry_date <= asOfDate)
        : journalLines;

      // Calculate balances per account
      const balanceMap: Record<string, { debits: number; credits: number }> = {};
      (filteredLines || []).forEach(line => {
        if (!balanceMap[line.account_id]) {
          balanceMap[line.account_id] = { debits: 0, credits: 0 };
        }
        balanceMap[line.account_id].debits += line.debit_amount || 0;
        balanceMap[line.account_id].credits += line.credit_amount || 0;
      });

      // Also get folio posting activity for ledger accounts
      const { data: folioPostings, error: folioError } = await supabase
        .from("folio_postings")
        .select(`
          account_id,
          debit_amount,
          credit_amount,
          posting_date,
          ledger_accounts!inner (
            property_id
          )
        `)
        .eq("ledger_accounts.property_id", selectedProperty.id)
        .eq("is_voided", false);

      if (!folioError && folioPostings) {
        const filteredPostings = asOfDate
          ? folioPostings.filter(p => p.posting_date <= asOfDate)
          : folioPostings;

        filteredPostings.forEach(posting => {
          if (posting.account_id) {
            if (!balanceMap[posting.account_id]) {
              balanceMap[posting.account_id] = { debits: 0, credits: 0 };
            }
            balanceMap[posting.account_id].debits += posting.debit_amount || 0;
            balanceMap[posting.account_id].credits += posting.credit_amount || 0;
          }
        });
      }

      // Build account list with balances
      const accountBalances: AccountBalance[] = (accountsData || []).map(acc => {
        const balance = balanceMap[acc.id] || { debits: 0, credits: 0 };
        const group = acc.account_groups as any;
        
        // Determine if balance should show in debit or credit column
        const netBalance = balance.debits - balance.credits;
        const normalBalance = acc.normal_balance;
        
        let debitBalance = 0;
        let creditBalance = 0;
        
        if (normalBalance === "debit") {
          // Asset/Expense accounts: positive is debit
          if (netBalance >= 0) {
            debitBalance = netBalance;
          } else {
            creditBalance = Math.abs(netBalance);
          }
        } else {
          // Liability/Equity/Revenue accounts: positive is credit
          if (netBalance <= 0) {
            creditBalance = Math.abs(netBalance);
          } else {
            debitBalance = netBalance;
          }
        }

        return {
          id: acc.id,
          code: acc.code,
          name: acc.name,
          groupName: group.name,
          groupType: group.account_type,
          normalBalance: acc.normal_balance,
          debitBalance,
          creditBalance,
        };
      });

      // Filter to only accounts with activity (non-zero balance)
      const activeAccounts = accountBalances.filter(
        acc => acc.debitBalance !== 0 || acc.creditBalance !== 0
      );

      // Sort by account code
      activeAccounts.sort((a, b) => a.code.localeCompare(b.code));

      setAccounts(activeAccounts);

      // Calculate totals
      const debits = activeAccounts.reduce((sum, acc) => sum + acc.debitBalance, 0);
      const credits = activeAccounts.reduce((sum, acc) => sum + acc.creditBalance, 0);
      setTotalDebits(debits);
      setTotalCredits(credits);

      // Notify parent of balance status
      const isBalanced = Math.abs(debits - credits) < 0.01;
      onBalanceCheck?.(isBalanced);
    } catch (error) {
      console.error("Error loading trial balance:", error);
      toast.error("Failed to load trial balance");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow popups for printing");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Trial Balance - ${selectedProperty?.name || "Property"}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          h1 { font-size: 24px; margin-bottom: 5px; }
          .subtitle { color: #666; margin-bottom: 20px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #ddd; }
          th { background: #f5f5f5; font-weight: bold; }
          .text-right { text-align: right; }
          .totals { font-weight: bold; border-top: 2px solid #333; }
          .balanced { color: green; }
          .unbalanced { color: red; }
          .group-header { background: #f9f9f9; font-weight: 600; }
          @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <h1>Trial Balance</h1>
        <p class="subtitle">${selectedProperty?.name || "Property"} - As of ${asOfDate ? format(new Date(asOfDate), "MMMM d, yyyy") : "Current"}</p>
        ${printContent.innerHTML}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const handleExport = async () => {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet("Trial Balance");
    ws.columns = [
      { header: "Account Code", key: "code", width: 16 },
      { header: "Account Name", key: "name", width: 36 },
      { header: "Account Group", key: "group", width: 24 },
      { header: "Debit", key: "debit", width: 16 },
      { header: "Credit", key: "credit", width: 16 },
    ];
    ws.getRow(1).font = { bold: true };

    accounts.forEach(acc => {
      ws.addRow({
        code: acc.code,
        name: acc.name,
        group: acc.groupName,
        debit: acc.debitBalance || "",
        credit: acc.creditBalance || "",
      });
    });
    ws.addRow({ code: "", name: "TOTALS", group: "", debit: totalDebits, credit: totalCredits }).font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `trial-balance-${asOfDate || "current"}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Trial Balance exported");
  };

  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

  // Group accounts by account group for display
  const groupedAccounts = accounts.reduce((groups, account) => {
    if (!groups[account.groupName]) {
      groups[account.groupName] = [];
    }
    groups[account.groupName].push(account);
    return groups;
  }, {} as Record<string, AccountBalance[]>);

  if (loading) {
    return (
      <Card className={compact ? "p-4" : "p-6"}>
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </Card>
    );
  }

  return (
    <Card className={compact ? "p-4" : "p-6"}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className={compact ? "text-lg font-semibold" : "text-xl font-semibold"}>
            Trial Balance
          </h3>
          {isBalanced ? (
            <Badge className="bg-green-500/10 text-green-700">
              <CheckCircle className="h-3 w-3 mr-1" />
              Balanced
            </Badge>
          ) : (
            <Badge variant="destructive">
              <AlertCircle className="h-3 w-3 mr-1" />
              Out of Balance: ${Math.abs(totalDebits - totalCredits).toFixed(2)}
            </Badge>
          )}
        </div>
        {showActions && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadTrialBalance}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        )}
      </div>

      {asOfDate && (
        <p className="text-sm text-muted-foreground mb-4">
          As of {format(new Date(asOfDate), "MMMM d, yyyy")}
        </p>
      )}

      <div ref={printRef}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">Code</TableHead>
              <TableHead>Account Name</TableHead>
              <TableHead className="text-right w-32">Debit</TableHead>
              <TableHead className="text-right w-32">Credit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Object.entries(groupedAccounts).map(([groupName, groupAccounts]) => (
              <>
                <TableRow key={`group-${groupName}`} className="bg-muted/30">
                  <TableCell colSpan={4} className="font-semibold text-muted-foreground">
                    {groupName}
                  </TableCell>
                </TableRow>
                {groupAccounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-mono text-sm">{account.code}</TableCell>
                    <TableCell>{account.name}</TableCell>
                    <TableCell className="text-right">
                      {account.debitBalance > 0 ? `$${account.debitBalance.toFixed(2)}` : ""}
                    </TableCell>
                    <TableCell className="text-right">
                      {account.creditBalance > 0 ? `$${account.creditBalance.toFixed(2)}` : ""}
                    </TableCell>
                  </TableRow>
                ))}
              </>
            ))}
            {accounts.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  No account activity found
                </TableCell>
              </TableRow>
            )}
            <TableRow className="font-bold border-t-2 border-foreground">
              <TableCell></TableCell>
              <TableCell>TOTALS</TableCell>
              <TableCell className="text-right">${totalDebits.toFixed(2)}</TableCell>
              <TableCell className="text-right">${totalCredits.toFixed(2)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};
