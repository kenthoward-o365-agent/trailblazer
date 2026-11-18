import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ArrowRightLeft, Plus } from "lucide-react";
import { toast } from "sonner";

interface Org { id: string; name: string; }
interface Property { id: string; name: string; organization_id: string; }
interface Transfer {
  id: string;
  organization_id: string;
  from_property_id: string;
  to_property_id: string;
  amount: number;
  currency: string;
  memo: string | null;
  reference: string | null;
  status: string;
  posted_at: string | null;
  created_at: string;
}

export default function IntercompanyTransfers() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [orgFilter, setOrgFilter] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    organization_id: "", from_property_id: "", to_property_id: "",
    amount: "", currency: "USD", memo: "", reference: "",
  });

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

  useEffect(() => { if (orgFilter) load(); }, [orgFilter]);

  async function load() {
    const { data } = await supabase.from("intercompany_transfers").select("*")
      .eq("organization_id", orgFilter).order("created_at", { ascending: false });
    setTransfers((data ?? []) as Transfer[]);
  }

  async function save() {
    const amt = Number(form.amount);
    if (!form.organization_id || !form.from_property_id || !form.to_property_id || !isFinite(amt) || amt <= 0) {
      toast.error("Fill in all fields"); return;
    }
    if (form.from_property_id === form.to_property_id) {
      toast.error("From and To must differ"); return;
    }
    const { error } = await supabase.from("intercompany_transfers").insert({
      organization_id: form.organization_id,
      from_property_id: form.from_property_id,
      to_property_id: form.to_property_id,
      amount: amt, currency: form.currency, memo: form.memo || null, reference: form.reference || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Transfer created"); setOpen(false); load();
  }

  async function post(t: Transfer) {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("intercompany_transfers").update({
      status: "posted", posted_at: new Date().toISOString(), posted_by: user?.id ?? null,
    }).eq("id", t.id);
    if (error) return toast.error(error.message);
    toast.success("Posted"); load();
  }
  async function reverse(t: Transfer) {
    const { error } = await supabase.from("intercompany_transfers")
      .update({ status: "reversed" }).eq("id", t.id);
    if (error) return toast.error(error.message);
    load();
  }

  const orgProps = useMemo(() => properties.filter((p) => p.organization_id === form.organization_id), [properties, form.organization_id]);
  const propName = (id: string) => properties.find((p) => p.id === id)?.name ?? id.slice(0, 8);

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><ArrowRightLeft className="h-7 w-7" /> Intercompany Transfers</h1>
            <p className="text-muted-foreground">Move funds between properties inside the same organization.</p>
          </div>
          <Button onClick={() => { setForm({ ...form, organization_id: orgFilter }); setOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" /> New transfer
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="max-w-xs">
              <Label>Organization</Label>
              <Select value={orgFilter} onValueChange={setOrgFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Transfers</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>From</TableHead><TableHead>To</TableHead>
                <TableHead>Amount</TableHead><TableHead>Reference</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {transfers.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{new Date(t.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>{propName(t.from_property_id)}</TableCell>
                    <TableCell>{propName(t.to_property_id)}</TableCell>
                    <TableCell>{t.currency} {Number(t.amount).toFixed(2)}</TableCell>
                    <TableCell>{t.reference ?? "—"}</TableCell>
                    <TableCell><Badge variant={t.status === "posted" ? "default" : t.status === "reversed" ? "destructive" : "outline"}>{t.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      {t.status === "pending" && <Button size="sm" onClick={() => post(t)}>Post</Button>}
                      {t.status === "posted" && <Button size="sm" variant="outline" onClick={() => reverse(t)}>Reverse</Button>}
                    </TableCell>
                  </TableRow>
                ))}
                {transfers.length === 0 && <TableRow><TableCell colSpan={7} className="text-muted-foreground text-sm">No transfers.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New intercompany transfer</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Organization</Label>
              <Select value={form.organization_id} onValueChange={(v) => setForm({ ...form, organization_id: v, from_property_id: "", to_property_id: "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>From property</Label>
                <Select value={form.from_property_id} onValueChange={(v) => setForm({ ...form, from_property_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Pick" /></SelectTrigger>
                  <SelectContent>{orgProps.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>To property</Label>
                <Select value={form.to_property_id} onValueChange={(v) => setForm({ ...form, to_property_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Pick" /></SelectTrigger>
                  <SelectContent>{orgProps.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Amount</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
              <div><Label>Currency</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} /></div>
            </div>
            <div><Label>Reference</Label><Input value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} /></div>
            <div><Label>Memo</Label><Textarea value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
