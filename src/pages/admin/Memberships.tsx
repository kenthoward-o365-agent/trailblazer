import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Award, Users, Coins } from "lucide-react";
import { toast } from "sonner";
import { useEnterpriseAccess } from "@/hooks/useEnterpriseAccess";

interface Program {
  id: string;
  organization_id: string;
  name: string;
  code: string | null;
  currency: string;
  billing_period: string;
  dues_amount: number;
  auto_renew_default: boolean;
  points_per_currency_unit: number;
  point_redemption_value: number;
  is_active: boolean;
  description: string | null;
}
interface Tier {
  id: string;
  program_id: string;
  name: string;
  priority: number;
  discount_percent: number;
  free_nights_per_year: number;
  max_consecutive_nights: number | null;
  cooldown_days: number;
  points_multiplier: number;
  is_active: boolean;
}
interface Property { id: string; name: string; }
interface Org { id: string; name: string; }
interface Member {
  id: string;
  member_number: string;
  status: string;
  points_balance: number;
  program_id: string;
  tier_id: string | null;
  guest_id: string | null;
  expires_at: string | null;
  auto_renew: boolean;
}

export default function Memberships() {
  const access = useEnterpriseAccess();
  const [tab, setTab] = useState("programs");
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [programProps, setProgramProps] = useState<Array<{ program_id: string; property_id: string; id: string }>>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);

  const [progDialog, setProgDialog] = useState(false);
  const [progForm, setProgForm] = useState({
    name: "", code: "", description: "", currency: "USD", billing_period: "annual",
    dues_amount: 0, auto_renew_default: true, points_per_currency_unit: 0, point_redemption_value: 0,
  });

  const [tierDialog, setTierDialog] = useState(false);
  const [tierForm, setTierForm] = useState({
    name: "", priority: 0, discount_percent: 0, free_nights_per_year: 0,
    max_consecutive_nights: "" as string | number, cooldown_days: 0, points_multiplier: 1,
  });

  useEffect(() => { loadOrgs(); }, [access.loading]);
  useEffect(() => { if (orgId) loadAll(orgId); }, [orgId]);

  async function loadOrgs() {
    if (access.loading) return;
    const { data } = await supabase.from("organizations").select("id,name").order("name");
    setOrgs(data ?? []);
    if (!orgId && (data ?? []).length) setOrgId(access.organizationId ?? data![0].id);
  }

  async function loadAll(oid: string) {
    const [pg, pr, mem] = await Promise.all([
      supabase.from("membership_programs").select("*").eq("organization_id", oid).order("name"),
      supabase.from("properties").select("id,name").eq("organization_id", oid).order("name"),
      supabase.from("member_accounts").select("*").eq("organization_id", oid).order("created_at", { ascending: false }).limit(200),
    ]);
    const progs = (pg.data ?? []) as Program[];
    setPrograms(progs);
    setProperties((pr.data ?? []) as Property[]);
    setMembers((mem.data ?? []) as Member[]);

    if (progs.length) {
      const [tRes, mppRes] = await Promise.all([
        supabase.from("membership_tiers").select("*").in("program_id", progs.map(p => p.id)).order("priority", { ascending: false }),
        supabase.from("membership_program_properties").select("id,program_id,property_id").in("program_id", progs.map(p => p.id)),
      ]);
      setTiers((tRes.data ?? []) as Tier[]);
      setProgramProps((mppRes.data ?? []) as any);
      if (!selectedProgramId) setSelectedProgramId(progs[0].id);
    } else {
      setTiers([]); setProgramProps([]);
    }
  }

  async function createProgram() {
    if (!orgId || !progForm.name) return;
    const { error } = await supabase.from("membership_programs").insert({
      organization_id: orgId,
      name: progForm.name,
      code: progForm.code || null,
      description: progForm.description || null,
      currency: progForm.currency,
      billing_period: progForm.billing_period as any,
      dues_amount: progForm.dues_amount,
      auto_renew_default: progForm.auto_renew_default,
      points_per_currency_unit: progForm.points_per_currency_unit,
      point_redemption_value: progForm.point_redemption_value,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Program created");
    setProgDialog(false);
    setProgForm({ name: "", code: "", description: "", currency: "USD", billing_period: "annual", dues_amount: 0, auto_renew_default: true, points_per_currency_unit: 0, point_redemption_value: 0 });
    loadAll(orgId);
  }

  async function toggleProgramActive(p: Program) {
    const { error } = await supabase.from("membership_programs").update({ is_active: !p.is_active }).eq("id", p.id);
    if (error) toast.error(error.message);
    else { toast.success("Updated"); loadAll(orgId!); }
  }

  async function createTier() {
    if (!selectedProgramId || !tierForm.name) return;
    const { error } = await supabase.from("membership_tiers").insert({
      program_id: selectedProgramId,
      name: tierForm.name,
      priority: tierForm.priority,
      discount_percent: tierForm.discount_percent,
      free_nights_per_year: tierForm.free_nights_per_year,
      max_consecutive_nights: tierForm.max_consecutive_nights === "" ? null : Number(tierForm.max_consecutive_nights),
      cooldown_days: tierForm.cooldown_days,
      points_multiplier: tierForm.points_multiplier,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Tier created");
    setTierDialog(false);
    setTierForm({ name: "", priority: 0, discount_percent: 0, free_nights_per_year: 0, max_consecutive_nights: "", cooldown_days: 0, points_multiplier: 1 });
    loadAll(orgId!);
  }

  async function toggleParkEligibility(programId: string, propertyId: string) {
    const existing = programProps.find(pp => pp.program_id === programId && pp.property_id === propertyId);
    if (existing) {
      const { error } = await supabase.from("membership_program_properties").delete().eq("id", existing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("membership_program_properties").insert({ program_id: programId, property_id: propertyId });
      if (error) return toast.error(error.message);
    }
    loadAll(orgId!);
  }

  const currentTiers = tiers.filter(t => t.program_id === selectedProgramId);
  const currentProps = programProps.filter(pp => pp.program_id === selectedProgramId);

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2"><Award className="h-6 w-6" /> Membership Programs</h1>
            <p className="text-muted-foreground text-sm">Design programs, tiers, park eligibility, and member accounts across your portfolio.</p>
          </div>
          {orgs.length > 1 && (
            <Select value={orgId ?? ""} onValueChange={setOrgId}>
              <SelectTrigger className="w-[240px]"><SelectValue /></SelectTrigger>
              <SelectContent>{orgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
            </Select>
          )}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="programs"><Award className="h-4 w-4 mr-1" /> Programs</TabsTrigger>
            <TabsTrigger value="tiers">Tiers & Benefits</TabsTrigger>
            <TabsTrigger value="parks">Park Eligibility</TabsTrigger>
            <TabsTrigger value="members"><Users className="h-4 w-4 mr-1" /> Members</TabsTrigger>
          </TabsList>

          <TabsContent value="programs" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setProgDialog(true)}><Plus className="h-4 w-4 mr-1" /> New Program</Button>
            </div>
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Billing</TableHead>
                    <TableHead>Dues</TableHead><TableHead>Points earn</TableHead><TableHead>Status</TableHead><TableHead />
                  </TableRow></TableHeader>
                  <TableBody>
                    {programs.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.name}</TableCell>
                        <TableCell><code className="text-xs">{p.code ?? "—"}</code></TableCell>
                        <TableCell>{p.billing_period}</TableCell>
                        <TableCell>{p.currency} {Number(p.dues_amount).toFixed(2)}</TableCell>
                        <TableCell>{p.points_per_currency_unit} pt / {p.currency} 1</TableCell>
                        <TableCell><Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                        <TableCell><Button size="sm" variant="ghost" onClick={() => toggleProgramActive(p)}>{p.is_active ? "Deactivate" : "Activate"}</Button></TableCell>
                      </TableRow>
                    ))}
                    {!programs.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No programs yet.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tiers" className="space-y-4">
            <div className="flex items-center gap-2 justify-between">
              <Select value={selectedProgramId ?? ""} onValueChange={setSelectedProgramId}>
                <SelectTrigger className="w-[280px]"><SelectValue placeholder="Select program" /></SelectTrigger>
                <SelectContent>{programs.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
              <Button onClick={() => setTierDialog(true)} disabled={!selectedProgramId}><Plus className="h-4 w-4 mr-1" /> New Tier</Button>
            </div>
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Tier</TableHead><TableHead>Priority</TableHead><TableHead>Discount</TableHead>
                    <TableHead>Free nights/yr</TableHead><TableHead>Max consec.</TableHead><TableHead>Cooldown</TableHead><TableHead>Points ×</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {currentTiers.map(t => (
                      <TableRow key={t.id}>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell>{t.priority}</TableCell>
                        <TableCell>{Number(t.discount_percent).toFixed(1)}%</TableCell>
                        <TableCell>{t.free_nights_per_year}</TableCell>
                        <TableCell>{t.max_consecutive_nights ?? "—"}</TableCell>
                        <TableCell>{t.cooldown_days}d</TableCell>
                        <TableCell>{Number(t.points_multiplier).toFixed(2)}×</TableCell>
                      </TableRow>
                    ))}
                    {!currentTiers.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">No tiers yet.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="parks" className="space-y-4">
            <Select value={selectedProgramId ?? ""} onValueChange={setSelectedProgramId}>
              <SelectTrigger className="w-[280px]"><SelectValue placeholder="Select program" /></SelectTrigger>
              <SelectContent>{programs.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
            <Card>
              <CardHeader><CardTitle className="text-base">Which parks honor this program?</CardTitle></CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {properties.map(p => {
                    const on = currentProps.some(pp => pp.property_id === p.id);
                    return (
                      <label key={p.id} className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-muted/50">
                        <Checkbox checked={on} onCheckedChange={() => selectedProgramId && toggleParkEligibility(selectedProgramId, p.id)} />
                        <span className="text-sm">{p.name}</span>
                      </label>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="members" className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Member #</TableHead><TableHead>Program</TableHead><TableHead>Status</TableHead>
                    <TableHead>Points</TableHead><TableHead>Expires</TableHead><TableHead>Auto-renew</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {members.map(m => {
                      const prog = programs.find(p => p.id === m.program_id);
                      return (
                        <TableRow key={m.id}>
                          <TableCell><code className="text-xs">{m.member_number}</code></TableCell>
                          <TableCell>{prog?.name ?? "—"}</TableCell>
                          <TableCell><Badge variant={m.status === "active" ? "default" : "secondary"}>{m.status}</Badge></TableCell>
                          <TableCell><Coins className="inline h-3 w-3 mr-1" />{Number(m.points_balance).toFixed(0)}</TableCell>
                          <TableCell>{m.expires_at ? new Date(m.expires_at).toLocaleDateString() : "—"}</TableCell>
                          <TableCell>{m.auto_renew ? "Yes" : "No"}</TableCell>
                        </TableRow>
                      );
                    })}
                    {!members.length && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No member accounts yet.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* New Program dialog */}
        <Dialog open={progDialog} onOpenChange={setProgDialog}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>New Membership Program</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={progForm.name} onChange={e => setProgForm({ ...progForm, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Code</Label><Input value={progForm.code} onChange={e => setProgForm({ ...progForm, code: e.target.value })} /></div>
                <div><Label>Currency</Label><Input value={progForm.currency} onChange={e => setProgForm({ ...progForm, currency: e.target.value.toUpperCase() })} /></div>
              </div>
              <div><Label>Description</Label><Textarea value={progForm.description} onChange={e => setProgForm({ ...progForm, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Billing period</Label>
                  <Select value={progForm.billing_period} onValueChange={v => setProgForm({ ...progForm, billing_period: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="quarterly">Quarterly</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                      <SelectItem value="lifetime">Lifetime</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Dues amount</Label><Input type="number" step="0.01" value={progForm.dues_amount} onChange={e => setProgForm({ ...progForm, dues_amount: Number(e.target.value) })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Points earned per {progForm.currency} 1</Label><Input type="number" step="0.01" value={progForm.points_per_currency_unit} onChange={e => setProgForm({ ...progForm, points_per_currency_unit: Number(e.target.value) })} /></div>
                <div><Label>Redeem value per point ({progForm.currency})</Label><Input type="number" step="0.01" value={progForm.point_redemption_value} onChange={e => setProgForm({ ...progForm, point_redemption_value: Number(e.target.value) })} /></div>
              </div>
              <label className="flex items-center gap-2"><Checkbox checked={progForm.auto_renew_default} onCheckedChange={c => setProgForm({ ...progForm, auto_renew_default: !!c })} /> Auto-renew by default</label>
            </div>
            <DialogFooter><Button variant="ghost" onClick={() => setProgDialog(false)}>Cancel</Button><Button onClick={createProgram}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* New Tier dialog */}
        <Dialog open={tierDialog} onOpenChange={setTierDialog}>
          <DialogContent>
            <DialogHeader><DialogTitle>New Tier</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name *</Label><Input value={tierForm.name} onChange={e => setTierForm({ ...tierForm, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Priority (higher = better)</Label><Input type="number" value={tierForm.priority} onChange={e => setTierForm({ ...tierForm, priority: Number(e.target.value) })} /></div>
                <div><Label>Discount %</Label><Input type="number" step="0.1" value={tierForm.discount_percent} onChange={e => setTierForm({ ...tierForm, discount_percent: Number(e.target.value) })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Free nights / year</Label><Input type="number" value={tierForm.free_nights_per_year} onChange={e => setTierForm({ ...tierForm, free_nights_per_year: Number(e.target.value) })} /></div>
                <div><Label>Max consecutive nights</Label><Input type="number" value={tierForm.max_consecutive_nights} onChange={e => setTierForm({ ...tierForm, max_consecutive_nights: e.target.value })} placeholder="unlimited" /></div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label>Cooldown days between stays</Label><Input type="number" value={tierForm.cooldown_days} onChange={e => setTierForm({ ...tierForm, cooldown_days: Number(e.target.value) })} /></div>
                <div><Label>Points multiplier</Label><Input type="number" step="0.1" value={tierForm.points_multiplier} onChange={e => setTierForm({ ...tierForm, points_multiplier: Number(e.target.value) })} /></div>
              </div>
            </div>
            <DialogFooter><Button variant="ghost" onClick={() => setTierDialog(false)}>Cancel</Button><Button onClick={createTier}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
