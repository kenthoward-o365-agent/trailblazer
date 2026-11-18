import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Copy, Check, Loader2, Rocket } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProvisioned?: () => void;
}

export function ProvisionCustomerDialog({ open, onOpenChange, onProvisioned }: Props) {
  const [busy, setBusy] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    org_name: "",
    admin_first_name: "",
    admin_last_name: "",
    admin_email: "",
    billing_email: "",
    property_name: "",
    timezone: "America/Los_Angeles",
    max_sites: 50,
    pricing_model: "per_site" as "per_site" | "flat",
    price_per_site: 5,
    flat_amount: 0,
    billing_cycle: "monthly" as "monthly" | "annual",
    contract_start_date: "",
    contract_end_date: "",
  });

  const update = (k: string, v: any) => setForm((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!form.org_name || !form.admin_email || !form.admin_first_name || !form.admin_last_name) {
      toast.error("Fill in organization and admin details");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("provision-organization", {
        body: {
          ...form,
          contract_start_date: form.contract_start_date || null,
          contract_end_date: form.contract_end_date || null,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success((data as any)?.message || "Customer provisioned");
      setInviteLink((data as any)?.invite_link || null);
      onProvisioned?.();
    } catch (e: any) {
      toast.error(e?.message || "Provisioning failed");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setInviteLink(null);
    setCopied(false);
    setForm({
      org_name: "", admin_first_name: "", admin_last_name: "", admin_email: "",
      billing_email: "", property_name: "", timezone: "America/Los_Angeles",
      max_sites: 50, pricing_model: "per_site", price_per_site: 5, flat_amount: 0,
      billing_cycle: "monthly", contract_start_date: "", contract_end_date: "",
    });
  };

  const copyLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Rocket className="h-5 w-5 text-primary" /> Provision New Customer</DialogTitle>
          <DialogDescription>
            Creates the organization, property, admin user, and subscription. The admin receives a welcome email with a secure sign-in link.
          </DialogDescription>
        </DialogHeader>

        {inviteLink ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
              <p className="text-sm font-medium">Customer provisioned!</p>
              <p className="text-sm text-muted-foreground mt-1">A welcome email has been sent. You can also share this direct invite link:</p>
              <div className="mt-3 flex gap-2">
                <Input value={inviteLink} readOnly className="font-mono text-xs" />
                <Button size="icon" variant="outline" onClick={copyLink}>
                  {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => { onOpenChange(false); reset(); }}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div className="text-sm font-medium">Organization</div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Organization Name *</Label>
                  <Input value={form.org_name} onChange={(e) => update("org_name", e.target.value)} placeholder="Acme Campgrounds" />
                </div>
                <div className="space-y-2">
                  <Label>Property Name</Label>
                  <Input value={form.property_name} onChange={(e) => update("property_name", e.target.value)} placeholder="Defaults to org name" />
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Input value={form.timezone} onChange={(e) => update("timezone", e.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Billing Email</Label>
                  <Input type="email" value={form.billing_email} onChange={(e) => update("billing_email", e.target.value)} placeholder="Defaults to admin email" />
                </div>
              </div>

              <div className="text-sm font-medium pt-2 border-t">Organization Admin</div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>First Name *</Label>
                  <Input value={form.admin_first_name} onChange={(e) => update("admin_first_name", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Last Name *</Label>
                  <Input value={form.admin_last_name} onChange={(e) => update("admin_last_name", e.target.value)} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Email *</Label>
                  <Input type="email" value={form.admin_email} onChange={(e) => update("admin_email", e.target.value)} placeholder="owner@customer.com" />
                </div>
              </div>

              <div className="text-sm font-medium pt-2 border-t">Subscription</div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Max Sites</Label>
                  <Input type="number" value={form.max_sites} onChange={(e) => update("max_sites", parseInt(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label>Billing Cycle</Label>
                  <Select value={form.billing_cycle} onValueChange={(v) => update("billing_cycle", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Pricing Model</Label>
                  <Select value={form.pricing_model} onValueChange={(v) => update("pricing_model", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="per_site">Per Site</SelectItem>
                      <SelectItem value="flat">Flat Amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  {form.pricing_model === "per_site" ? (
                    <>
                      <Label>Price / Site ($)</Label>
                      <Input type="number" step="0.01" value={form.price_per_site} onChange={(e) => update("price_per_site", parseFloat(e.target.value) || 0)} />
                    </>
                  ) : (
                    <>
                      <Label>Flat Amount ($)</Label>
                      <Input type="number" step="0.01" value={form.flat_amount} onChange={(e) => update("flat_amount", parseFloat(e.target.value) || 0)} />
                    </>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Contract Start</Label>
                  <Input type="date" value={form.contract_start_date} onChange={(e) => update("contract_start_date", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Contract End</Label>
                  <Input type="date" value={form.contract_end_date} onChange={(e) => update("contract_end_date", e.target.value)} />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
              <Button onClick={submit} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Rocket className="h-4 w-4 mr-1" />}
                Provision Customer
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
