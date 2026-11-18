import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  BookOpen,
  CreditCard,
  Users,
  Building2,
  RefreshCw,
} from "lucide-react";
import { AdvanceDepositLedger } from "@/components/accounting/AdvanceDepositLedger";
import { GuestLedger } from "@/components/accounting/GuestLedger";
import { CityLedger } from "@/components/accounting/CityLedger";
import { ChartOfAccounts } from "@/components/accounting/ChartOfAccounts";
import { JournalEntries } from "@/components/accounting/JournalEntries";
import { QuickBooksIntegration } from "@/components/settings/QuickBooksIntegration";
import { useProperty } from "@/contexts/PropertyContext";


interface LedgerSummary {
  type: string;
  count: number;
  total_balance: number;
}

const Accounting = () => {
  const { selectedProperty } = useProperty();
  const [activeTab, setActiveTab] = useState("overview");
  const [ledgerSummary, setLedgerSummary] = useState<LedgerSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedProperty?.id) {
      loadSummary();
    }
  }, [selectedProperty?.id]);

  const loadSummary = async () => {
    if (!selectedProperty?.id) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ledger_accounts")
        .select("ledger_type, balance")
        .eq("property_id", selectedProperty.id)
        .eq("is_active", true);

      if (error) throw error;

      // Aggregate by ledger type
      const summary: Record<string, { count: number; total: number }> = {
        advance_deposit: { count: 0, total: 0 },
        guest: { count: 0, total: 0 },
        city: { count: 0, total: 0 },
      };

      data?.forEach((account) => {
        if (summary[account.ledger_type]) {
          summary[account.ledger_type].count++;
          summary[account.ledger_type].total += parseFloat(String(account.balance)) || 0;
        }
      });

      setLedgerSummary(
        Object.entries(summary).map(([type, data]) => ({
          type,
          count: data.count,
          total_balance: data.total,
        }))
      );
    } catch (error) {
      console.error("Error loading summary:", error);
      toast.error("Failed to load accounting summary");
    } finally {
      setLoading(false);
    }
  };

  const getLedgerIcon = (type: string) => {
    switch (type) {
      case "advance_deposit":
        return <CreditCard className="h-5 w-5" />;
      case "guest":
        return <Users className="h-5 w-5" />;
      case "city":
        return <Building2 className="h-5 w-5" />;
      default:
        return <BookOpen className="h-5 w-5" />;
    }
  };

  const getLedgerLabel = (type: string) => {
    switch (type) {
      case "advance_deposit":
        return "Advance Deposit Ledger";
      case "guest":
        return "Guest Ledger";
      case "city":
        return "City Ledger";
      default:
        return type;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Accounting</h1>
            <p className="text-muted-foreground">
              Manage ledgers, journal entries, and financial reports
            </p>
          </div>
          <Button variant="outline" onClick={loadSummary} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <div className="overflow-x-auto -mx-3 px-3 sm:mx-0 sm:px-0">
            <TabsList className="inline-flex w-max sm:grid sm:grid-cols-7 sm:w-full sm:max-w-5xl">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="advance">Advance Deposits</TabsTrigger>
              <TabsTrigger value="guest">Guest Ledger</TabsTrigger>
              <TabsTrigger value="city">City Ledger</TabsTrigger>
              <TabsTrigger value="chart">Chart of Accounts</TabsTrigger>
              <TabsTrigger value="journal">Journal</TabsTrigger>
              <TabsTrigger value="quickbooks">Integrations</TabsTrigger>
            </TabsList>

          </div>

          <TabsContent value="overview" className="space-y-6">
            {/* Ledger Summary Cards */}
            <div className="grid md:grid-cols-3 gap-4">
              {ledgerSummary.map((ledger) => (
                <Card
                  key={ledger.type}
                  className="p-6 cursor-pointer hover:border-primary transition-colors"
                  onClick={() =>
                    setActiveTab(
                      ledger.type === "advance_deposit"
                        ? "advance"
                        : ledger.type === "guest"
                        ? "guest"
                        : "city"
                    )
                  }
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      {getLedgerIcon(ledger.type)}
                    </div>
                    <Badge variant="secondary">{ledger.count} accounts</Badge>
                  </div>
                  <h3 className="font-semibold mb-1">{getLedgerLabel(ledger.type)}</h3>
                  <p
                    className={`text-2xl font-bold ${
                      ledger.total_balance >= 0 ? "text-primary" : "text-destructive"
                    }`}
                  >
                    ${Math.abs(ledger.total_balance).toFixed(2)}
                    {ledger.total_balance < 0 && " CR"}
                  </p>
                </Card>
              ))}
            </div>

            {/* Chart of Accounts Preview */}
            <ChartOfAccounts compact />
          </TabsContent>

          <TabsContent value="advance">
            <AdvanceDepositLedger />
          </TabsContent>

          <TabsContent value="guest">
            <GuestLedger />
          </TabsContent>

          <TabsContent value="city">
            <CityLedger />
          </TabsContent>

          <TabsContent value="chart">
            <ChartOfAccounts />
          </TabsContent>

          <TabsContent value="journal">
            <JournalEntries />
          </TabsContent>

          <TabsContent value="quickbooks">
            {selectedProperty?.id ? (
              <QuickBooksIntegration propertyId={selectedProperty.id} />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                Select a property to manage QuickBooks integration.
              </div>
            )}
          </TabsContent>

        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Accounting;