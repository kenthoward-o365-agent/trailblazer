import { useRef, useEffect, useState } from "react";
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
import { Printer, TrendingUp, DollarSign, Clock, Users, Loader2 } from "lucide-react";
import { CityLedgerAgingChart } from "./CityLedgerAgingChart";
import { differenceInDays, format } from "date-fns";
import { useProperty } from "@/contexts/PropertyContext";
import { supabase } from "@/integrations/supabase/client";

interface LedgerAccount {
  id: string;
  company_name: string | null;
  contact_name: string | null;
  contact_email: string | null;
  phone: string | null;
  balance: number;
}

interface Invoice {
  id: string;
  city_ledger_account_id: string;
  transfer_date: string;
  original_amount: number;
  paid_amount: number;
  status: string;
}

interface CityLedgerAgingReportProps {
  accounts: LedgerAccount[];
  propertyId: string;
  onSelectAccount?: (account: LedgerAccount) => void;
}

export function CityLedgerAgingReport({ accounts, propertyId, onSelectAccount }: CityLedgerAgingReportProps) {
  const { selectedProperty } = useProperty();
  const printRef = useRef<HTMLDivElement>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInvoices();
  }, [propertyId]);

  const loadInvoices = async () => {
    if (!propertyId) return;
    
    setLoading(true);
    try {
      const { data } = await supabase
        .from("city_ledger_invoices")
        .select("id, city_ledger_account_id, transfer_date, original_amount, paid_amount, status")
        .eq("property_id", propertyId)
        .neq("status", "paid");

      setInvoices(data || []);
    } catch (error) {
      console.error("Error loading invoices:", error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate aging for an account's invoices
  const calculateAging = (accountId: string) => {
    const aging = { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 };
    const accountInvoices = invoices.filter(inv => inv.city_ledger_account_id === accountId);
    
    accountInvoices.forEach((inv) => {
      const balance = inv.original_amount - inv.paid_amount;
      const days = differenceInDays(new Date(), new Date(inv.transfer_date));
      
      if (days <= 0) aging.current += balance;
      else if (days <= 30) aging.days30 += balance;
      else if (days <= 60) aging.days60 += balance;
      else if (days <= 90) aging.days90 += balance;
      else aging.over90 += balance;
    });
    
    return aging;
  };

  // Calculate totals
  const accountsWithAging = accounts.map((acc) => {
    const aging = calculateAging(acc.id);
    const totalBalance = Object.values(aging).reduce((a, b) => a + b, 0);
    return { ...acc, aging, totalBalance };
  });

  const totalAging = accountsWithAging.reduce(
    (totals, acc) => ({
      current: totals.current + acc.aging.current,
      days30: totals.days30 + acc.aging.days30,
      days60: totals.days60 + acc.aging.days60,
      days90: totals.days90 + acc.aging.days90,
      over90: totals.over90 + acc.aging.over90,
    }),
    { current: 0, days30: 0, days60: 0, days90: 0, over90: 0 }
  );

  const totalBalance = Object.values(totalAging).reduce((a, b) => a + b, 0);
  const accountsWithBalance = accountsWithAging.filter((acc) => acc.totalBalance > 0);
  const overdueAmount = totalAging.days30 + totalAging.days60 + totalAging.days90 + totalAging.over90;

  // Calculate average days outstanding
  const avgDaysOutstanding =
    invoices.length > 0
      ? invoices.reduce(
          (sum, inv) => sum + differenceInDays(new Date(), new Date(inv.transfer_date)),
          0
        ) / invoices.length
      : 0;

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Aging Report - ${selectedProperty?.name}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
            th { background-color: #f5f5f5; }
            .text-right { text-align: right; }
            .header { text-align: center; margin-bottom: 30px; }
            .summary-cards { display: flex; justify-content: space-around; margin: 20px 0; }
            .summary-card { text-align: center; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
            h1 { margin: 0; }
            .total-row { font-weight: bold; background-color: #f9f9f9; }
            @media print { 
              body { margin: 20px; }
              @page { size: landscape; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${selectedProperty?.name || "Property"}</h1>
            <p>Accounts Receivable Aging Report</p>
            <p>As of ${format(new Date(), "MMMM d, yyyy")}</p>
          </div>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <DollarSign className="h-4 w-4" />
            <span className="text-sm">Total A/R</span>
          </div>
          <p className="text-2xl font-bold">${totalBalance.toFixed(2)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Users className="h-4 w-4" />
            <span className="text-sm">Accounts with Balance</span>
          </div>
          <p className="text-2xl font-bold">{accountsWithBalance.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm">Overdue Amount</span>
          </div>
          <p className="text-2xl font-bold text-destructive">${overdueAmount.toFixed(2)}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Avg Days Outstanding</span>
          </div>
          <p className="text-2xl font-bold">{Math.round(avgDaysOutstanding)}</p>
        </Card>
      </div>

      {/* Chart and Details */}
      <div className="grid grid-cols-3 gap-6">
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Aging Distribution</h3>
          <CityLedgerAgingChart data={totalAging} size="large" />
        </Card>

        <Card className="p-6 col-span-2" ref={printRef}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Aging by Account</h3>
            <Button size="sm" variant="outline" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print Report
            </Button>
          </div>

          {accountsWithBalance.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No accounts with outstanding balances
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-right">Current</TableHead>
                    <TableHead className="text-right">1-30</TableHead>
                    <TableHead className="text-right">31-60</TableHead>
                    <TableHead className="text-right">61-90</TableHead>
                    <TableHead className="text-right">90+</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accountsWithBalance
                    .sort((a, b) => b.totalBalance - a.totalBalance)
                    .map((account) => (
                      <TableRow 
                        key={account.id} 
                        className={onSelectAccount ? "cursor-pointer hover:bg-muted/50" : ""}
                        onClick={() => onSelectAccount?.(account)}
                      >
                        <TableCell className="font-medium">
                          {account.company_name || account.contact_name || "Unknown"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {account.phone || account.contact_email || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {account.aging.current > 0 ? `$${account.aging.current.toFixed(2)}` : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {account.aging.days30 > 0 ? (
                            <span className="text-yellow-600">${account.aging.days30.toFixed(2)}</span>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {account.aging.days60 > 0 ? (
                            <span className="text-orange-600">${account.aging.days60.toFixed(2)}</span>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {account.aging.days90 > 0 ? (
                            <span className="text-red-600">${account.aging.days90.toFixed(2)}</span>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {account.aging.over90 > 0 ? (
                            <span className="text-red-700 font-semibold">${account.aging.over90.toFixed(2)}</span>
                          ) : "-"}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          ${account.totalBalance.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  {/* Totals Row */}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell colSpan={2}>TOTALS</TableCell>
                    <TableCell className="text-right">${totalAging.current.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-yellow-600">
                      ${totalAging.days30.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-orange-600">
                      ${totalAging.days60.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      ${totalAging.days90.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-red-700">
                      ${totalAging.over90.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-lg">
                      ${totalBalance.toFixed(2)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
