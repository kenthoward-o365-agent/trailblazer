import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { FileText, Download, RefreshCw } from "lucide-react";
import { format, differenceInDays, startOfDay, subDays } from "date-fns";
import { TrialBalance } from "./TrialBalance";

interface LedgerActivity {
  ledgerType: string;
  openingBalance: number;
  debits: number;
  credits: number;
  closingBalance: number;
  transactions: number;
}

interface AgingBucket {
  range: string;
  count: number;
  amount: number;
}

interface DailyRevenue {
  date: string;
  room: number;
  other: number;
  total: number;
}

type ReportTab = "trial-balance" | "ledger-activity" | "aging" | "daily-revenue";

interface AccountingReportsProps {
  defaultTab?: ReportTab;
}

export const AccountingReports = ({ defaultTab = "trial-balance" }: AccountingReportsProps) => {
  const [activeReport, setActiveReport] = useState<ReportTab>(defaultTab);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(
    format(subDays(new Date(), 30), "yyyy-MM-dd")
  );
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [ledgerActivity, setLedgerActivity] = useState<LedgerActivity[]>([]);
  const [aging, setAging] = useState<AgingBucket[]>([]);
  const [dailyRevenue, setDailyRevenue] = useState<DailyRevenue[]>([]);

  // Sync with external defaultTab changes
  useEffect(() => {
    setActiveReport(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    if (activeReport !== "trial-balance") {
      loadReport();
    }
  }, [activeReport, dateFrom, dateTo]);

  const loadReport = async () => {
    setLoading(true);
    try {
      switch (activeReport) {
        case "ledger-activity":
          await loadLedgerActivity();
          break;
        case "aging":
          await loadAging();
          break;
        case "daily-revenue":
          await loadDailyRevenue();
          break;
      }
    } catch (error) {
      console.error("Error loading report:", error);
      toast.error("Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  const loadLedgerActivity = async () => {
    const { data: ledgers, error } = await supabase
      .from("ledger_accounts")
      .select(`
        ledger_type,
        balance,
        ledger_transactions (
          debit_amount,
          credit_amount,
          transaction_date
        )
      `)
      .gte("ledger_transactions.transaction_date", dateFrom)
      .lte("ledger_transactions.transaction_date", dateTo);

    if (error) throw error;

    // Aggregate by ledger type
    const summary: Record<
      string,
      { opening: number; debits: number; credits: number; closing: number; txCount: number }
    > = {};

    ledgers?.forEach((ledger) => {
      const type = ledger.ledger_type;
      if (!summary[type]) {
        summary[type] = { opening: 0, debits: 0, credits: 0, closing: 0, txCount: 0 };
      }
      summary[type].closing += parseFloat(String(ledger.balance)) || 0;
      ledger.ledger_transactions?.forEach((tx) => {
        summary[type].debits += parseFloat(String(tx.debit_amount)) || 0;
        summary[type].credits += parseFloat(String(tx.credit_amount)) || 0;
        summary[type].txCount++;
      });
    });

    // Calculate opening = closing - debits + credits
    Object.values(summary).forEach((s) => {
      s.opening = s.closing - s.debits + s.credits;
    });

    setLedgerActivity(
      Object.entries(summary).map(([type, data]) => ({
        ledgerType: type,
        openingBalance: data.opening,
        debits: data.debits,
        credits: data.credits,
        closingBalance: data.closing,
        transactions: data.txCount,
      }))
    );
  };

  const loadAging = async () => {
    const { data, error } = await supabase
      .from("ledger_accounts")
      .select("opened_at, balance")
      .eq("ledger_type", "city")
      .eq("is_active", true)
      .gt("balance", 0);

    if (error) throw error;

    const buckets = {
      "0-30 days": { count: 0, amount: 0 },
      "31-60 days": { count: 0, amount: 0 },
      "61-90 days": { count: 0, amount: 0 },
      "90+ days": { count: 0, amount: 0 },
    };

    const today = startOfDay(new Date());

    data?.forEach((account) => {
      const days = differenceInDays(today, new Date(account.opened_at));
      const balance = parseFloat(String(account.balance)) || 0;

      if (days <= 30) {
        buckets["0-30 days"].count++;
        buckets["0-30 days"].amount += balance;
      } else if (days <= 60) {
        buckets["31-60 days"].count++;
        buckets["31-60 days"].amount += balance;
      } else if (days <= 90) {
        buckets["61-90 days"].count++;
        buckets["61-90 days"].amount += balance;
      } else {
        buckets["90+ days"].count++;
        buckets["90+ days"].amount += balance;
      }
    });

    setAging(
      Object.entries(buckets).map(([range, data]) => ({
        range,
        count: data.count,
        amount: data.amount,
      }))
    );
  };

  const loadDailyRevenue = async () => {
    const { data, error } = await supabase
      .from("ledger_transactions")
      .select(`
        transaction_date,
        debit_amount,
        description,
        ledger_accounts!inner (
          ledger_type
        )
      `)
      .eq("ledger_accounts.ledger_type", "guest")
      .eq("transaction_type", "charge")
      .gte("transaction_date", dateFrom)
      .lte("transaction_date", dateTo)
      .order("transaction_date");

    if (error) throw error;

    // Group by date
    const byDate: Record<string, { room: number; other: number }> = {};

    data?.forEach((tx) => {
      const date = format(new Date(tx.transaction_date), "yyyy-MM-dd");
      if (!byDate[date]) {
        byDate[date] = { room: 0, other: 0 };
      }
      const amount = parseFloat(String(tx.debit_amount)) || 0;
      if (tx.description?.toLowerCase().includes("site") || tx.description?.toLowerCase().includes("room")) {
        byDate[date].room += amount;
      } else {
        byDate[date].other += amount;
      }
    });

    setDailyRevenue(
      Object.entries(byDate).map(([date, data]) => ({
        date,
        room: data.room,
        other: data.other,
        total: data.room + data.other,
      }))
    );
  };

  const getLedgerLabel = (type: string) => {
    switch (type) {
      case "advance_deposit":
        return "Advance Deposit";
      case "guest":
        return "Guest Ledger";
      case "city":
        return "City Ledger";
      default:
        return type;
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-end mb-4">
        <Button variant="outline" size="sm" onClick={loadReport} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:flex sm:gap-4 mb-4">
        <div>
          <Label>From Date</Label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div>
          <Label>To Date</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
      </div>

      <Tabs value={activeReport} onValueChange={(v) => setActiveReport(v as ReportTab)}>
        <TabsList className="w-full flex overflow-x-auto sm:inline-flex sm:w-auto">
          <TabsTrigger value="trial-balance">Trial Balance</TabsTrigger>
          <TabsTrigger value="ledger-activity">Ledger Activity</TabsTrigger>
          <TabsTrigger value="aging">Aging Report</TabsTrigger>
          <TabsTrigger value="daily-revenue">Daily Revenue</TabsTrigger>
        </TabsList>


        <TabsContent value="trial-balance">
          <TrialBalance asOfDate={dateTo} />
        </TabsContent>

        <TabsContent value="ledger-activity">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ledger</TableHead>
                  <TableHead className="text-right">Opening</TableHead>
                  <TableHead className="text-right">Debits</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                  <TableHead className="text-right">Closing</TableHead>
                  <TableHead className="text-right">Transactions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ledgerActivity.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No activity in selected period
                    </TableCell>
                  </TableRow>
                ) : (
                  ledgerActivity.map((row) => (
                    <TableRow key={row.ledgerType}>
                      <TableCell>{getLedgerLabel(row.ledgerType)}</TableCell>
                      <TableCell className="text-right">
                        ${row.openingBalance.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">${row.debits.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${row.credits.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-semibold">
                        ${row.closingBalance.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">{row.transactions}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="aging">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Age Range</TableHead>
                  <TableHead className="text-right">Accounts</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aging.map((bucket) => (
                  <TableRow key={bucket.range}>
                    <TableCell>{bucket.range}</TableCell>
                    <TableCell className="text-right">{bucket.count}</TableCell>
                    <TableCell className="text-right font-semibold">
                      ${bucket.amount.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-semibold border-t-2">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">
                    {aging.reduce((sum, b) => sum + b.count, 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    ${aging.reduce((sum, b) => sum + b.amount, 0).toFixed(2)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </TabsContent>

        <TabsContent value="daily-revenue">
          {loading ? (
            <p className="text-center text-muted-foreground py-8">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Site Revenue</TableHead>
                  <TableHead className="text-right">Other Revenue</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dailyRevenue.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No revenue in selected period
                    </TableCell>
                  </TableRow>
                ) : (
                  <>
                    {dailyRevenue.map((row) => (
                      <TableRow key={row.date}>
                        <TableCell>{format(new Date(row.date), "MMM d, yyyy")}</TableCell>
                        <TableCell className="text-right">${row.room.toFixed(2)}</TableCell>
                        <TableCell className="text-right">${row.other.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-semibold">
                          ${row.total.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="font-semibold border-t-2">
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right">
                        ${dailyRevenue.reduce((sum, r) => sum + r.room, 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        ${dailyRevenue.reduce((sum, r) => sum + r.other, 0).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        ${dailyRevenue.reduce((sum, r) => sum + r.total, 0).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  </>
                )}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
};