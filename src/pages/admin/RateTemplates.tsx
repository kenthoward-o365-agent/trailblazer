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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Rocket, Layers } from "lucide-react";
import { toast } from "sonner";

interface Template {
  id: string;
  organization_id: string;
  brand_id: string | null;
  region_id: string | null;
  scope: string;
  template_code: string;
  name: string;
  description: string | null;
  deposit_requirement: string | null;
  is_active: boolean;
}
interface Org { id: string; name: string; }
interface Brand { id: string; name: string; organization_id: string; }
interface Region { id: string; name: string; brand_id: string; }
interface Property { id: string; name: string; brand_id: string | null; region_id: string | null; organization_id: string; }
interface Price { id?: string; site_type_code: string; price: number; }
interface Restriction { id?: string; start_date: string; end_date: string; min_los: number | null; max_los: number | null; cta: boolean; ctd: boolean; stop_sell: boolean; }

export default function RateTemplates() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<Template | null>(null);
  const [prices, setPrices] = useState<Price[]>([]);
  const [restrictions, setRestrictions] = useState<Restriction[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [pushOpen, setPushOpen] = useState(false);
  const [pushProps, setPushProps] = useState<string[]>([]);
  const [pushStart, setPushStart] = useState("");
  const [pushEnd, setPushEnd] = useState("");
  const [pushing, setPushing] = useState(false);
  const [pushResults, setPushResults] = useState<any[] | null>(null);

  const [form, setForm] = useState({
    organization_id: "", brand_id: "", region_id: "", scope: "brand",
    template_code: "", name: "", description: "", deposit_requirement: "none",
  });

  useEffect(() => { loadAll(); }, []);
  useEffect(() => { if (selected) loadTemplateDetails(selected.id); }, [selected]);

  async function loadAll() {
    const [o, b, r, p, t] = await Promise.all([
      supabase.from("organizations").select("id,name").order("name"),
      supabase.from("brands").select("id,name,organization_id").order("name"),
      supabase.from("regions").select("id,name,brand_id").order("name"),
      supabase.from("properties").select("id,name,brand_id,region_id,organization_id").order("name"),
      supabase.from("rate_templates").select("*").order("created_at", { ascending: false }),
    ]);
    setOrgs(o.data ?? []);
    setBrands(b.data ?? []);
    setRegions(r.data ?? []);
    setProperties(p.data ?? []);
    setTemplates((t.data ?? []) as Template[]);
  }

  async function loadTemplateDetails(id: string) {
    const [pr, rr] = await Promise.all([
      supabase.from("rate_template_site_type_prices").select("*").eq("template_id", id),
      supabase.from("rate_template_restrictions").select("*").eq("template_id", id).order("start_date"),
    ]);
    setPrices((pr.data ?? []) as Price[]);
    setRestrictions((rr.data ?? []) as Restriction[]);
  }

  async function createTemplate() {
    if (!form.organization_id || !form.template_code || !form.name) {
      toast.error("Organization, code, and name are required"); return;
    }
    const payload: any = {
      organization_id: form.organization_id,
      scope: form.scope,
      brand_id: form.scope === "organization" ? null : (form.brand_id || null),
      region_id: form.scope === "region" ? (form.region_id || null) : null,
      template_code: form.template_code,
      name: form.name,
      description: form.description || null,
      deposit_requirement: form.deposit_requirement,
    };
    const { error, data } = await supabase.from("rate_templates").insert(payload).select().single();
    if (error) { toast.error(error.message); return; }
    toast.success("Template created");
    setCreateOpen(false);
    await loadAll();
    setSelected(data as Template);
  }

  async function addPrice() {
    if (!selected) return;
    const code = prompt("Site type code (must match target property site_types.code)");
    if (!code) return;
    const priceStr = prompt("Nightly price");
    const price = Number(priceStr);
    if (!isFinite(price)) return;
    const { error } = await supabase.from("rate_template_site_type_prices")
      .insert({ template_id: selected.id, site_type_code: code, price });
    if (error) return toast.error(error.message);
    loadTemplateDetails(selected.id);
  }
  async function removePrice(id?: string) {
    if (!id || !selected) return;
    await supabase.from("rate_template_site_type_prices").delete().eq("id", id);
    loadTemplateDetails(selected.id);
  }

  async function addRestriction() {
    if (!selected) return;
    const { error } = await supabase.from("rate_template_restrictions").insert({
      template_id: selected.id,
      start_date: new Date().toISOString().slice(0, 10),
      end_date: new Date().toISOString().slice(0, 10),
      min_los: null, max_los: null, cta: false, ctd: false, stop_sell: false,
    });
    if (error) return toast.error(error.message);
    loadTemplateDetails(selected.id);
  }
  async function saveRestriction(r: Restriction) {
    if (!r.id) return;
    const { id, ...rest } = r;
    await supabase.from("rate_template_restrictions").update(rest).eq("id", id);
  }
  async function removeRestriction(id?: string) {
    if (!id || !selected) return;
    await supabase.from("rate_template_restrictions").delete().eq("id", id);
    loadTemplateDetails(selected.id);
  }

  const eligibleProperties = useMemo(() => {
    if (!selected) return [] as Property[];
    return properties.filter((p) => {
      if (p.organization_id !== selected.organization_id) return false;
      if (selected.scope === "brand" && selected.brand_id) return p.brand_id === selected.brand_id;
      if (selected.scope === "region" && selected.region_id) return p.region_id === selected.region_id;
      return true;
    });
  }, [selected, properties]);

  async function runPush() {
    if (!selected || pushProps.length === 0 || !pushStart || !pushEnd) {
      toast.error("Pick properties and a date range"); return;
    }
    setPushing(true); setPushResults(null);
    const { data, error } = await supabase.functions.invoke("rate-template-push", {
      body: { template_id: selected.id, property_ids: pushProps, start_date: pushStart, end_date: pushEnd },
    });
    setPushing(false);
    if (error) { toast.error(error.message); return; }
    setPushResults(data?.results ?? []);
    toast.success("Push complete");
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><Layers className="h-7 w-7" /> Rate Templates</h1>
            <p className="text-muted-foreground">Corporate rate templates and bulk push across brands, regions, and parks.</p>
          </div>
          <Button onClick={() => setCreateOpen(true)}><Plus className="mr-2 h-4 w-4" /> New Template</Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1">
            <CardHeader><CardTitle>Templates</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {templates.length === 0 && <p className="text-sm text-muted-foreground">No templates yet.</p>}
              {templates.map((t) => (
                <button key={t.id} onClick={() => setSelected(t)}
                  className={`w-full text-left rounded border p-3 hover:bg-accent ${selected?.id === t.id ? "border-primary bg-accent" : ""}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{t.template_code}</span>
                    <Badge variant="outline">{t.scope}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">{t.name}</div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{selected ? `${selected.template_code} · ${selected.name}` : "Select a template"}</CardTitle>
              {selected && (
                <Button onClick={() => setPushOpen(true)} size="sm">
                  <Rocket className="mr-2 h-4 w-4" /> Push to properties
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {!selected && <p className="text-sm text-muted-foreground">Pick a template to view prices and restrictions.</p>}
              {selected && (
                <>
                  <section>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">Prices by site-type code</h3>
                      <Button size="sm" variant="outline" onClick={addPrice}><Plus className="h-4 w-4 mr-1" />Add</Button>
                    </div>
                    <Table>
                      <TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Price</TableHead><TableHead /></TableRow></TableHeader>
                      <TableBody>
                        {prices.map((p) => (
                          <TableRow key={p.id}>
                            <TableCell>{p.site_type_code}</TableCell>
                            <TableCell>${Number(p.price).toFixed(2)}</TableCell>
                            <TableCell className="text-right">
                              <Button size="sm" variant="ghost" onClick={() => removePrice(p.id)}>Remove</Button>
                            </TableCell>
                          </TableRow>
                        ))}
                        {prices.length === 0 && <TableRow><TableCell colSpan={3} className="text-muted-foreground text-sm">No prices yet.</TableCell></TableRow>}
                      </TableBody>
                    </Table>
                  </section>

                  <section>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">Restrictions</h3>
                      <Button size="sm" variant="outline" onClick={addRestriction}><Plus className="h-4 w-4 mr-1" />Add</Button>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Start</TableHead><TableHead>End</TableHead>
                          <TableHead>Min LOS</TableHead><TableHead>Max LOS</TableHead>
                          <TableHead>CTA</TableHead><TableHead>CTD</TableHead><TableHead>Stop</TableHead><TableHead />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {restrictions.map((r, i) => (
                          <TableRow key={r.id}>
                            <TableCell><Input type="date" value={r.start_date} onChange={(e) => { const c = [...restrictions]; c[i] = { ...r, start_date: e.target.value }; setRestrictions(c); saveRestriction(c[i]); }} /></TableCell>
                            <TableCell><Input type="date" value={r.end_date} onChange={(e) => { const c = [...restrictions]; c[i] = { ...r, end_date: e.target.value }; setRestrictions(c); saveRestriction(c[i]); }} /></TableCell>
                            <TableCell><Input type="number" value={r.min_los ?? ""} className="w-20" onChange={(e) => { const c = [...restrictions]; c[i] = { ...r, min_los: e.target.value ? +e.target.value : null }; setRestrictions(c); saveRestriction(c[i]); }} /></TableCell>
                            <TableCell><Input type="number" value={r.max_los ?? ""} className="w-20" onChange={(e) => { const c = [...restrictions]; c[i] = { ...r, max_los: e.target.value ? +e.target.value : null }; setRestrictions(c); saveRestriction(c[i]); }} /></TableCell>
                            <TableCell><Checkbox checked={r.cta} onCheckedChange={(v) => { const c = [...restrictions]; c[i] = { ...r, cta: !!v }; setRestrictions(c); saveRestriction(c[i]); }} /></TableCell>
                            <TableCell><Checkbox checked={r.ctd} onCheckedChange={(v) => { const c = [...restrictions]; c[i] = { ...r, ctd: !!v }; setRestrictions(c); saveRestriction(c[i]); }} /></TableCell>
                            <TableCell><Checkbox checked={r.stop_sell} onCheckedChange={(v) => { const c = [...restrictions]; c[i] = { ...r, stop_sell: !!v }; setRestrictions(c); saveRestriction(c[i]); }} /></TableCell>
                            <TableCell><Button size="sm" variant="ghost" onClick={() => removeRestriction(r.id)}>Remove</Button></TableCell>
                          </TableRow>
                        ))}
                        {restrictions.length === 0 && <TableRow><TableCell colSpan={8} className="text-muted-foreground text-sm">No restrictions.</TableCell></TableRow>}
                      </TableBody>
                    </Table>
                  </section>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New Rate Template</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Organization</Label>
              <Select value={form.organization_id} onValueChange={(v) => setForm({ ...form, organization_id: v, brand_id: "", region_id: "" })}>
                <SelectTrigger><SelectValue placeholder="Pick org" /></SelectTrigger>
                <SelectContent>{orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Scope</Label>
              <Select value={form.scope} onValueChange={(v) => setForm({ ...form, scope: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="organization">Organization</SelectItem>
                  <SelectItem value="brand">Brand</SelectItem>
                  <SelectItem value="region">Region</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.scope !== "organization" && (
              <div><Label>Brand</Label>
                <Select value={form.brand_id} onValueChange={(v) => setForm({ ...form, brand_id: v, region_id: "" })}>
                  <SelectTrigger><SelectValue placeholder="Pick brand" /></SelectTrigger>
                  <SelectContent>{brands.filter(b => b.organization_id === form.organization_id).map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            {form.scope === "region" && (
              <div><Label>Region</Label>
                <Select value={form.region_id} onValueChange={(v) => setForm({ ...form, region_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Pick region" /></SelectTrigger>
                  <SelectContent>{regions.filter(r => r.brand_id === form.brand_id).map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div><Label>Code</Label><Input value={form.template_code} onChange={(e) => setForm({ ...form, template_code: e.target.value })} placeholder="e.g. BAR-2026" /></div>
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Deposit requirement</Label>
              <Select value={form.deposit_requirement} onValueChange={(v) => setForm({ ...form, deposit_requirement: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="first_night">First night</SelectItem>
                  <SelectItem value="full_stay">Full stay</SelectItem>
                  <SelectItem value="percentage">Percentage</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createTemplate}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Push dialog */}
      <Dialog open={pushOpen} onOpenChange={(v) => { setPushOpen(v); if (!v) setPushResults(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Push template to properties</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Rate start</Label><Input type="date" value={pushStart} onChange={(e) => setPushStart(e.target.value)} /></div>
              <div><Label>Rate end</Label><Input type="date" value={pushEnd} onChange={(e) => setPushEnd(e.target.value)} /></div>
            </div>
            <div>
              <Label>Target properties ({eligibleProperties.length} eligible)</Label>
              <div className="max-h-60 overflow-auto border rounded p-2 space-y-1">
                {eligibleProperties.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={pushProps.includes(p.id)}
                      onCheckedChange={(v) => setPushProps(v ? [...pushProps, p.id] : pushProps.filter((x) => x !== p.id))}
                    />
                    {p.name}
                  </label>
                ))}
                {eligibleProperties.length === 0 && <p className="text-sm text-muted-foreground">No eligible properties for this template's scope.</p>}
              </div>
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="outline" onClick={() => setPushProps(eligibleProperties.map((p) => p.id))}>Select all</Button>
                <Button size="sm" variant="outline" onClick={() => setPushProps([])}>Clear</Button>
              </div>
            </div>
            {pushResults && (
              <div className="border rounded p-2 max-h-48 overflow-auto text-xs">
                {pushResults.map((r: any, i: number) => (
                  <div key={i} className={r.ok ? "text-green-600" : "text-destructive"}>
                    {r.property_id}: {r.ok ? `ok (${r.priceRows} prices, ${r.ruleRows} rules)` : `error — ${r.error}`}
                  </div>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPushOpen(false)}>Close</Button>
            <Button disabled={pushing} onClick={runPush}>{pushing ? "Pushing…" : "Push now"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
