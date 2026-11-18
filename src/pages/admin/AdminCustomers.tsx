import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { RefreshCw, Plus, Pencil, Building2, CreditCard, Settings2, Pause, Play, Link2, Rocket } from "lucide-react";
import { ProvisionCustomerDialog } from "@/components/admin/ProvisionCustomerDialog";

interface Customer {
  id: string;
  client_number: number | null;
  name: string;
  billing_email: string | null;
  payment_status: string;
  share_chart_of_accounts: boolean;
  share_reporting: boolean;
  share_user_access: boolean;
  hubspot_company_id: string | null;
  // Subscription data
  subscription_id: string | null;
  max_sites: number;
  billing_cycle: string;
  price_per_site: number;
  pricing_model: "per_site" | "flat";
  flat_amount: number;
  suspended_at: string | null;
  suspension_reason: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  hubspot_deal_id: string | null;
  hubspot_last_synced_at: string | null;
  // Computed
  property_count: number;
  current_site_count: number;
}

export default function AdminCustomers() {
  const { isSuperAdmin, loading: superAdminLoading } = useSuperAdmin();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [activeTab, setActiveTab] = useState("account");

  // Form state
  const [formName, setFormName] = useState("");
  const [formBillingEmail, setFormBillingEmail] = useState("");
  const [formPaymentStatus, setFormPaymentStatus] = useState("active");
  const [formMaxSites, setFormMaxSites] = useState(50);
  const [formBillingCycle, setFormBillingCycle] = useState("monthly");
  const [formPricingModel, setFormPricingModel] = useState<"per_site" | "flat">("per_site");
  const [formPricePerSite, setFormPricePerSite] = useState(0);
  const [formFlatAmount, setFormFlatAmount] = useState(0);
  const [formShareChartOfAccounts, setFormShareChartOfAccounts] = useState(false);
  const [formShareReporting, setFormShareReporting] = useState(false);
  const [formShareUserAccess, setFormShareUserAccess] = useState(false);
  const [formContractStart, setFormContractStart] = useState<string>("");
  const [formContractEnd, setFormContractEnd] = useState<string>("");
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [provisionOpen, setProvisionOpen] = useState(false);

  useEffect(() => {
    if (isSuperAdmin) {
      loadCustomers();
    }
  }, [isSuperAdmin]);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      // Fetch organizations with subscriptions
      const { data: orgs, error: orgsError } = await supabase
        .from("organizations")
        .select("*")
        .order("name");

      if (orgsError) throw orgsError;

      // Fetch subscriptions
      const { data: subs, error: subsError } = await supabase
        .from("subscriptions")
        .select("*");

      if (subsError) throw subsError;

      // Fetch properties with site counts
      const { data: properties, error: propsError } = await supabase
        .from("properties")
        .select("id, organization_id");

      if (propsError) throw propsError;

      // Fetch site counts per property
      const { data: sites, error: sitesError } = await supabase
        .from("sites")
        .select("id, property_id");

      if (sitesError) throw sitesError;

      // Build customer list
      const customerList: Customer[] = (orgs || []).map((org) => {
        const subscription = subs?.find((s) => s.organization_id === org.id);
        const orgProperties = properties?.filter((p) => p.organization_id === org.id) || [];
        const orgPropertyIds = orgProperties.map((p) => p.id);
        const siteCount = sites?.filter((s) => orgPropertyIds.includes(s.property_id)).length || 0;

        return {
          id: org.id,
          client_number: (org as any).client_number ?? null,
          name: org.name,
          billing_email: org.billing_email,
          payment_status: org.payment_status,
          share_chart_of_accounts: org.share_chart_of_accounts || false,
          share_reporting: org.share_reporting || false,
          share_user_access: org.share_user_access || false,
          subscription_id: subscription?.id || null,
          max_sites: subscription?.max_sites || 50,
          billing_cycle: subscription?.billing_cycle || "monthly",
          price_per_site: Number(subscription?.price_per_site ?? 0),
          pricing_model: ((subscription as any)?.pricing_model as "per_site" | "flat") || "per_site",
          flat_amount: Number((subscription as any)?.flat_amount ?? 0),
          suspended_at: subscription?.suspended_at || null,
          suspension_reason: subscription?.suspension_reason || null,
          contract_start_date: (subscription as any)?.contract_start_date ?? null,
          contract_end_date: (subscription as any)?.contract_end_date ?? null,
          hubspot_deal_id: (subscription as any)?.hubspot_deal_id ?? null,
          hubspot_last_synced_at: (subscription as any)?.hubspot_last_synced_at ?? null,
          hubspot_company_id: (org as any).hubspot_company_id ?? null,
          property_count: orgProperties.length,
          current_site_count: siteCount,
        };
      });

      setCustomers(customerList);
    } catch (error) {
      console.error("Error loading customers:", error);
      toast.error("Failed to load customers");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (editingCustomer) {
        // Update organization
        const { error: orgError } = await supabase
          .from("organizations")
          .update({
            name: formName,
            billing_email: formBillingEmail || null,
            payment_status: formPaymentStatus,
            share_chart_of_accounts: formShareChartOfAccounts,
            share_reporting: formShareReporting,
            share_user_access: formShareUserAccess,
          })
          .eq("id", editingCustomer.id);

        if (orgError) throw orgError;

        // Update or create subscription
        if (editingCustomer.subscription_id) {
          const { error: subError } = await supabase
            .from("subscriptions")
            .update({
              max_sites: formMaxSites,
              billing_cycle: formBillingCycle,
              price_per_site: formPricePerSite,
              pricing_model: formPricingModel,
              flat_amount: formFlatAmount,
              contract_start_date: formContractStart || null,
              contract_end_date: formContractEnd || null,
            } as any)
            .eq("id", editingCustomer.subscription_id);

          if (subError) throw subError;
        } else {
          const { error: subError } = await supabase
            .from("subscriptions")
            .insert({
              organization_id: editingCustomer.id,
              max_sites: formMaxSites,
              billing_cycle: formBillingCycle,
              price_per_site: formPricePerSite,
              pricing_model: formPricingModel,
              flat_amount: formFlatAmount,
              contract_start_date: formContractStart || null,
              contract_end_date: formContractEnd || null,
            } as any);

          if (subError) throw subError;
        }

        toast.success("Customer updated successfully");
      } else {
        // Create new organization
        const { data: newOrg, error: orgError } = await supabase
          .from("organizations")
          .insert({
            name: formName,
            billing_email: formBillingEmail || null,
            payment_status: formPaymentStatus,
            share_chart_of_accounts: formShareChartOfAccounts,
            share_reporting: formShareReporting,
            share_user_access: formShareUserAccess,
          })
          .select()
          .single();

        if (orgError) throw orgError;

        // Create subscription
        const { error: subError } = await supabase
          .from("subscriptions")
          .insert({
            organization_id: newOrg.id,
            max_sites: formMaxSites,
            billing_cycle: formBillingCycle,
            price_per_site: formPricePerSite,
            pricing_model: formPricingModel,
            flat_amount: formFlatAmount,
            contract_start_date: formContractStart || null,
            contract_end_date: formContractEnd || null,
          } as any);

        if (subError) throw subError;

        toast.success("Customer created successfully");
      }

      setDialogOpen(false);
      resetForm();
      loadCustomers();
    } catch (error) {
      console.error("Error saving customer:", error);
      toast.error("Failed to save customer");
    }
  };

  const openEditDialog = (customer: Customer) => {
    setEditingCustomer(customer);
    setFormName(customer.name);
    setFormBillingEmail(customer.billing_email || "");
    setFormPaymentStatus(customer.payment_status);
    setFormMaxSites(customer.max_sites);
    setFormBillingCycle(customer.billing_cycle);
    setFormPricingModel(customer.pricing_model);
    setFormPricePerSite(customer.price_per_site);
    setFormFlatAmount(customer.flat_amount);
    setFormShareChartOfAccounts(customer.share_chart_of_accounts);
    setFormShareReporting(customer.share_reporting);
    setFormShareUserAccess(customer.share_user_access);
    setFormContractStart(customer.contract_start_date || "");
    setFormContractEnd(customer.contract_end_date || "");
    setActiveTab("account");
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const resetForm = () => {
    setEditingCustomer(null);
    setFormName("");
    setFormBillingEmail("");
    setFormPaymentStatus("active");
    setFormMaxSites(50);
    setFormBillingCycle("monthly");
    setFormPricingModel("per_site");
    setFormPricePerSite(0);
    setFormFlatAmount(0);
    setFormShareChartOfAccounts(false);
    setFormShareReporting(false);
    setFormShareUserAccess(false);
    setFormContractStart("");
    setFormContractEnd("");
    setActiveTab("account");
  };

  const syncToHubSpot = async (customer: Customer) => {
    try {
      setSyncingId(customer.id);
      const { data, error } = await supabase.functions.invoke("hubspot-sync-customer", {
        body: { organization_id: customer.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`Synced ${customer.name} to HubSpot`);
      await loadCustomers();
    } catch (e: any) {
      toast.error(e?.message ?? "HubSpot sync failed");
    } finally {
      setSyncingId(null);
    }
  };

  const toggleSuspension = async (customer: Customer) => {
    try {
      if (customer.suspended_at) {
        // Reactivate
        if (customer.subscription_id) {
          await supabase.from("subscriptions").update({
            suspended_at: null, suspension_reason: null,
          }).eq("id", customer.subscription_id);
        }
        await supabase.from("organizations").update({ payment_status: "active" }).eq("id", customer.id);
        toast.success(`${customer.name} reactivated`);
      } else {
        const reason = window.prompt(
          `Suspend ${customer.name}?\n\nEnter a reason (e.g. "Payment past due"):`,
          "Payment past due",
        );
        if (reason === null) return;
        if (customer.subscription_id) {
          await supabase.from("subscriptions").update({
            suspended_at: new Date().toISOString(),
            suspension_reason: reason || "Suspended by admin",
          }).eq("id", customer.subscription_id);
        }
        await supabase.from("organizations").update({ payment_status: "suspended" }).eq("id", customer.id);
        toast.success(`${customer.name} suspended`);
      }
      await loadCustomers();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to update subscription");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30">Active</Badge>;
      case "suspended":
        return <Badge className="bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30">Suspended</Badge>;
      case "cancelled":
        return <Badge className="bg-muted text-muted-foreground">Cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getUsageBadge = (current: number, max: number) => {
    const percentage = (current / max) * 100;
    if (percentage >= 100) {
      return <Badge className="bg-red-500/20 text-red-700 dark:text-red-400 border-red-500/30">At Limit</Badge>;
    } else if (percentage >= 80) {
      return <Badge className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30">Near Limit</Badge>;
    }
    return <Badge className="bg-green-500/20 text-green-700 dark:text-green-400 border-green-500/30">OK</Badge>;
  };

  if (superAdminLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  if (!isSuperAdmin) {
    return (
      <DashboardLayout>
        <div className="p-6">
          <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
          <p className="text-muted-foreground">Super admin access required.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Customers</h1>
            <p className="text-muted-foreground">
              Manage customer accounts, subscriptions, and feature settings
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadCustomers}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" onClick={() => setProvisionOpen(true)}>
              <Rocket className="h-4 w-4 mr-2" />
              Provision Customer
            </Button>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Customer
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Client #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Billing Email</TableHead>
                  <TableHead>Properties</TableHead>
                  <TableHead>Sites</TableHead>
                  <TableHead>Billing</TableHead>
                  <TableHead>Sharing</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                      No customers found
                    </TableCell>
                  </TableRow>
                ) : (
                  customers.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell className="font-mono text-sm">{customer.client_number ?? "-"}</TableCell>
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {customer.billing_email || "-"}
                      </TableCell>
                      <TableCell>{customer.property_count}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{customer.current_site_count} / {customer.max_sites}</span>
                          {getUsageBadge(customer.current_site_count, customer.max_sites)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {customer.pricing_model === "flat"
                            ? `$${Number(customer.flat_amount).toFixed(2)} flat ${customer.billing_cycle}`
                            : `$${Number(customer.price_per_site).toFixed(2)}/site ${customer.billing_cycle}`}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {customer.share_chart_of_accounts && (
                            <Badge variant="outline" className="text-xs">CoA</Badge>
                          )}
                          {customer.share_reporting && (
                            <Badge variant="outline" className="text-xs">Reports</Badge>
                          )}
                          {customer.share_user_access && (
                            <Badge variant="outline" className="text-xs">Users</Badge>
                          )}
                          {!customer.share_chart_of_accounts && !customer.share_reporting && !customer.share_user_access && (
                            <span className="text-muted-foreground text-sm">None</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getStatusBadge(customer.payment_status)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title={customer.suspended_at ? "Reactivate subscription" : "Suspend subscription"}
                            onClick={() => toggleSuspension(customer)}
                          >
                            {customer.suspended_at
                              ? <Play className="h-4 w-4 text-green-600" />
                              : <Pause className="h-4 w-4 text-amber-600" />}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title={customer.hubspot_company_id ? "Re-sync to HubSpot" : "Sync to HubSpot"}
                            disabled={syncingId === customer.id}
                            onClick={() => syncToHubSpot(customer)}
                          >
                            <Link2 className={`h-4 w-4 ${customer.hubspot_company_id ? "text-primary" : "text-muted-foreground"}`} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(customer)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingCustomer ? "Edit Customer" : "Add Customer"}
              </DialogTitle>
            </DialogHeader>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="account" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Account
                </TabsTrigger>
                <TabsTrigger value="subscription" className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Subscription
                </TabsTrigger>
                <TabsTrigger value="features" className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Features
                </TabsTrigger>
              </TabsList>

              <TabsContent value="account" className="space-y-4 mt-4">
                {editingCustomer && (
                  <div className="space-y-2">
                    <Label>Client Number</Label>
                    <Input value={editingCustomer.client_number ?? ""} disabled className="font-mono" />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="name">Customer Name *</Label>
                  <Input
                    id="name"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Acme RV Parks"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Billing Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formBillingEmail}
                    onChange={(e) => setFormBillingEmail(e.target.value)}
                    placeholder="billing@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Payment Status</Label>
                  <Select value={formPaymentStatus} onValueChange={setFormPaymentStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              <TabsContent value="subscription" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="maxSites">Max Sites</Label>
                  <Input
                    id="maxSites"
                    type="number"
                    value={formMaxSites}
                    onChange={(e) => setFormMaxSites(parseInt(e.target.value) || 0)}
                  />
                  {editingCustomer && (
                    <p className="text-sm text-muted-foreground">
                      Currently using {editingCustomer.current_site_count} sites
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="billingCycle">Billing Cycle</Label>
                  <Select value={formBillingCycle} onValueChange={setFormBillingCycle}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pricingModel">Pricing Model</Label>
                  <Select value={formPricingModel} onValueChange={(v) => setFormPricingModel(v as "per_site" | "flat")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="per_site">Per Site</SelectItem>
                      <SelectItem value="flat">Flat Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formPricingModel === "per_site" ? (
                  <div className="space-y-2">
                    <Label htmlFor="pricePerSite">Price Per Site ($)</Label>
                    <Input
                      id="pricePerSite"
                      type="number"
                      step="0.01"
                      value={formPricePerSite}
                      onChange={(e) => setFormPricePerSite(parseFloat(e.target.value) || 0)}
                    />
                    <p className="text-xs text-muted-foreground">
                      MRR ≈ ${(formPricePerSite * formMaxSites * (formBillingCycle === "annual" ? 1/12 : 1)).toFixed(2)}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="flatAmount">Flat Amount ($)</Label>
                    <Input
                      id="flatAmount"
                      type="number"
                      step="0.01"
                      value={formFlatAmount}
                      onChange={(e) => setFormFlatAmount(parseFloat(e.target.value) || 0)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Charged {formBillingCycle}. MRR ≈ ${(formFlatAmount * (formBillingCycle === "annual" ? 1/12 : 1)).toFixed(2)}
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t">
                  <div className="space-y-2">
                    <Label htmlFor="contractStart">Contract Start</Label>
                    <Input
                      id="contractStart"
                      type="date"
                      value={formContractStart}
                      onChange={(e) => setFormContractStart(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contractEnd">Contract End</Label>
                    <Input
                      id="contractEnd"
                      type="date"
                      value={formContractEnd}
                      onChange={(e) => setFormContractEnd(e.target.value)}
                    />
                  </div>
                  <p className="col-span-2 text-xs text-muted-foreground">
                    Contract dates sync to HubSpot as deal properties (start, close, and end date).
                  </p>
                </div>
                {editingCustomer && (
                  <div className="rounded-md border p-3 text-sm space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">HubSpot</div>
                        <div className="text-xs text-muted-foreground">
                          {editingCustomer.hubspot_company_id
                            ? `Company ${editingCustomer.hubspot_company_id}${editingCustomer.hubspot_deal_id ? ` · Deal ${editingCustomer.hubspot_deal_id}` : ""}`
                            : "Not synced yet"}
                          {editingCustomer.hubspot_last_synced_at &&
                            ` · Last sync ${new Date(editingCustomer.hubspot_last_synced_at).toLocaleString()}`}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={syncingId === editingCustomer.id}
                        onClick={() => syncToHubSpot(editingCustomer)}
                      >
                        <Link2 className="h-4 w-4 mr-1" />
                        {syncingId === editingCustomer.id ? "Syncing…" : "Sync to HubSpot"}
                      </Button>
                    </div>
                  </div>
                )}
                {editingCustomer?.suspended_at && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                    <div className="font-medium text-amber-700 dark:text-amber-400">Subscription suspended</div>
                    <div className="text-muted-foreground text-xs mt-1">
                      Since {new Date(editingCustomer.suspended_at).toLocaleDateString()} — {editingCustomer.suspension_reason || "no reason given"}
                    </div>
                    <Button size="sm" className="mt-2" onClick={() => editingCustomer && toggleSuspension(editingCustomer)}>
                      <Play className="h-4 w-4 mr-1" />Reactivate
                    </Button>
                  </div>
                )}
                {editingCustomer && !editingCustomer.suspended_at && (
                  <Button variant="outline" size="sm" onClick={() => toggleSuspension(editingCustomer)}>
                    <Pause className="h-4 w-4 mr-1" />Suspend for payment issue
                  </Button>
                )}
              </TabsContent>

              <TabsContent value="features" className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Enable feature sharing across all properties in this customer account.
                </p>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="shareCoA"
                      checked={formShareChartOfAccounts}
                      onCheckedChange={(checked) => setFormShareChartOfAccounts(checked === true)}
                    />
                    <div>
                      <Label htmlFor="shareCoA" className="cursor-pointer">Share Chart of Accounts</Label>
                      <p className="text-sm text-muted-foreground">All properties use the same account structure</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="shareReporting"
                      checked={formShareReporting}
                      onCheckedChange={(checked) => setFormShareReporting(checked === true)}
                    />
                    <div>
                      <Label htmlFor="shareReporting" className="cursor-pointer">Share Cross-Property Reporting</Label>
                      <p className="text-sm text-muted-foreground">Enable consolidated reports across properties</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-3">
                    <Checkbox
                      id="shareUserAccess"
                      checked={formShareUserAccess}
                      onCheckedChange={(checked) => setFormShareUserAccess(checked === true)}
                    />
                    <div>
                      <Label htmlFor="shareUserAccess" className="cursor-pointer">Share User Access</Label>
                      <p className="text-sm text-muted-foreground">Users can access multiple properties</p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!formName.trim()}>
                {editingCustomer ? "Save Changes" : "Create Customer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ProvisionCustomerDialog
          open={provisionOpen}
          onOpenChange={setProvisionOpen}
          onProvisioned={loadCustomers}
        />
      </div>
    </DashboardLayout>
  );
}
