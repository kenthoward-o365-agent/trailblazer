import { DashboardLayout } from "@/components/DashboardLayout";
import { AccountingReports } from "@/components/accounting/AccountingReports";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Bot } from "lucide-react";

const Reports = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground">
            Financial reports, ledger activity, and TrailGuide automations
          </p>
        </div>

        <Tabs defaultValue="accounting">
          <TabsList>
            <TabsTrigger value="accounting">Accounting Reports</TabsTrigger>
            <TabsTrigger value="trailguide">TrailGuide Items</TabsTrigger>
          </TabsList>
          <TabsContent value="accounting" className="mt-4">
            <AccountingReports />
          </TabsContent>
          <TabsContent value="trailguide" className="mt-4">
            <Card className="p-6 flex items-center justify-between">
              <div className="flex items-start gap-3">
                <Bot className="w-6 h-6 text-primary mt-1" />
                <div>
                  <div className="font-semibold">TrailGuide Items</div>
                  <p className="text-sm text-muted-foreground max-w-xl">
                    Saved TrailGuide jobs — run on demand or on a schedule, delivered by SMS, email, or in-app.
                    Great for daily arrival lists, weekly forecasts, or approval-gated automations.
                  </p>
                </div>
              </div>
              <Link to="/reports/trailguide-items">
                <Button>
                  Manage items <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Reports;
