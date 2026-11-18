import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Building2, Plus } from "lucide-react";
import { toast } from "sonner";

interface Org { id: string; name: string; }
interface Property { id: string; name: string; organization_id: string; }
interface Customer {
  id: string; organization_id: string; name: string; code: string | null;
  billing_email: string | null; credit_limit: number | null; notes: string | null; is_active: boolean;
}

export default function ConsolidatedAR() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [orgFilter, setOrgFilter] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [links, setLinks] = useState<{ id: string; property_id: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", code: "", billing_email: "", credit_limit: "", notes: "" });

  useEffect(() => {
    (async () => {
      const [o, p] = await Promise.all([
        supabase.from("organizations").select("id,name").order("name"),
        supabase.from("properties").select("id,name,organization_id").order("name"),
      ]);
      setOrgs(o.data ?? []); setProperties(p.data ?? []);
      if (o.data && o.data.length) setOrgFilter(o.data[0].id);
    })();
  }, []);

  useEffect(() => { if (orgFilter) loadCustomers(); }, [orgFilter]);
  useEffect(() => { if (selected) loadLinks(); }, [selected]);

  async function loadCustomers() {
    const { data } = await supabase.from("consolidated_ar_customers").select("*")
      .eq("organization_id", orgFilter).order("name");
    setCustomers((data ?? []) as Customer[]);
  }
  async function loadLinks() {
    if (!selected) return;
    const { data } = await supabase.from("consolidated_ar_links").select("id,property_id")
      .eq("customer_id", selected.id);
    setLinks((data ?? []) as any);
  }

  async function createCustomer() {
    if (!form.name) return toast.error("Name required");
    const { error } = await supabase.from("consolidated_ar_customers").insert({
      organization_id: orgFilter,
      name: form.name, code: form.code || null,
      billing_email: form.billing_email || null,
      credit_limit: form.credit_limit ? Number(form.credit_limit) : null,
      notes: form.notes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Created"); setOpen(false);
    setForm({ name: "", code: "", billing_email: "", credit_limit: "", notes: "" });
    loadCustomers();
  }

  async function toggleLink(propertyId: string, on: boolean) {
    if (!selected) return;
    if (on) {
      await supabase.from("consolidated_ar_links").insert({ customer_id: selected.id, property_id: propertyId });
    } else {
      await supabase.from("consolidated_ar_links").delete()
        .eq("customer_id", selected.id).eq("property_id", propertyId);
    }
    loadLinks();
  }

  const orgProps = useMemo(() => properties.filter((p) => p.organization_id === orgFilter), [properties, orgFilter]);
  const linkedIds = new Set(links.map((l) => l.property_id));

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><Building2 className="h-7 w-7" /> Consolidated AR</h1>
            <p className="text-muted-foreground">Corporate accounts spanning multiple parks (fleet, government, film crews).</p>
          </div>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" /> New corporate account</Button>
        </div>

        <Card>
          <CardContent className="pt-6 max-w-xs">
            <Label>Organization</Label>
            <Select value={orgFilter} onValueChange={setOrgFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
            </Select>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader><CardTitle>Accounts</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {customers.map((c) => (
                <button key={c.id} onClick={() => setSelected(c)}
                  className={`w-full text-left rounded border p-3 hover:bg-accent ${selected?.id === c.id ? "border-primary bg-accent" : ""}`}>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-sm text-muted-foreground">{c.code ?? "no code"} · {c.billing_email ?? "no email"}</div>
                </button>
              ))}
              {customers.length === 0 && <p className="text-sm text-muted-foreground">No corporate accounts yet.</p>}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader><CardTitle>{selected ? `${selected.name} — linked properties` : "Pick an account"}</CardTitle></CardHeader>
            <CardContent>
              {!selected && <p className="text-sm text-muted-foreground">Select a corporate account to manage per-park links.</p>}
              {selected && (
                <Table>
                  <TableHeader><TableRow><TableHead>Property</TableHead><TableHead>Linked</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {orgProps.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.name}</TableCell>
                        <TableCell>
                          <Checkbox checked={linkedIds.has(p.id)}
                            onCheckedChange={(v) => toggleLink(p.id, !!v)} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New corporate AR account</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Code</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
              <div><Label>Credit limit</Label><Input type="number" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: e.target.value })} /></div>
            </div>
            <div><Label>Billing email</Label><Input value={form.billing_email} onChange={(e) => setForm({ ...form, billing_email: e.target.value })} /></div>
            <div><Label>Notes</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={createCustomer}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
