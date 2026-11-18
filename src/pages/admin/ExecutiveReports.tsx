import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileBarChart, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

interface Org { id: string; name: string; }
interface Brand { id: string; name: string; organization_id: string; }
interface Region { id: string; name: string; brand_id: string; }
interface Snapshot {
  id: string; organization_id: string; brand_id: string | null; region_id: string | null;
  scope: string; period_start: string; period_end: string; kpis: any; computed_at: string;
}

export default function ExecutiveReports() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [snaps, setSnaps] = useState<Snapshot[]>([]);
  const [orgId, setOrgId] = useState("");
  const [brandId, setBrandId] = useState("__all");
  const [regionId, setRegionId] = useState("__all");
  const today = new Date().toISOString().slice(0, 10);
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    (async () => {
      const [o, b, r] = await Promise.all([
        supabase.from("organizations").select("id,name").order("name"),
        supabase.from("brands").select("id,name,organization_id").order("name"),
        supabase.from("regions").select("id,name,brand_id").order("name"),
      ]);
      setOrgs(o.data ?? []); setBrands(b.data ?? []); setRegions(r.data ?? []);
      if (o.data && o.data.length) setOrgId(o.data[0].id);
    })();
  }, []);

  useEffect(() => { if (orgId) load(); }, [orgId]);

  async function load() {
    const { data } = await supabase.from("executive_report_snapshots").select("*")
      .eq("organization_id", orgId).order("computed_at", { ascending: false }).limit(50);
    setSnaps((data ?? []) as Snapshot[]);
  }

  async function run() {
    setRunning(true);
    const { error } = await supabase.functions.invoke("executive-report-run", {
      body: {
        organization_id: orgId,
        brand_id: brandId === "__all" ? null : brandId,
        region_id: regionId === "__all" ? null : regionId,
        period_start: from, period_end: to,
      },
    });
    setRunning(false);
    if (error) return toast.error(error.message);
    toast.success("Snapshot computed"); load();
  }

  const filteredBrands = useMemo(() => brands.filter((b) => b.organization_id === orgId), [brands, orgId]);
  const filteredRegions = useMemo(() => regions.filter((r) => brandId === "__all" || r.brand_id === brandId), [regions, brandId]);

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><FileBarChart className="h-7 w-7" /> Executive Reports</h1>
          <p className="text-muted-foreground">Portfolio KPI snapshots across brands and regions.</p>
        </div>

        <Card>
          <CardHeader><CardTitle>Run a snapshot</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <div><Label>Org</Label>
              <Select value={orgId} onValueChange={setOrgId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{orgs.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Brand</Label>
              <Select value={brandId} onValueChange={(v) => { setBrandId(v); setRegionId("__all"); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All</SelectItem>
                  {filteredBrands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Region</Label>
              <Select value={regionId} onValueChange={setRegionId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All</SelectItem>
                  {filteredRegions.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <div className="flex items-end">
              <Button onClick={run} disabled={running}>
                <RefreshCcw className={`h-4 w-4 mr-2 ${running ? "animate-spin" : ""}`} /> Run
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent snapshots</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Computed</TableHead><TableHead>Scope</TableHead><TableHead>Period</TableHead>
                <TableHead>Revenue</TableHead><TableHead>Occupancy</TableHead>
                <TableHead>ADR</TableHead><TableHead>RevPAR</TableHead><TableHead>Members</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {snaps.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{new Date(s.computed_at).toLocaleString()}</TableCell>
                    <TableCell>{s.scope}</TableCell>
                    <TableCell>{s.period_start} → {s.period_end}</TableCell>
                    <TableCell>${Number(s.kpis?.total_revenue ?? 0).toFixed(0)}</TableCell>
                    <TableCell>{Number(s.kpis?.occupancy_pct ?? 0).toFixed(1)}%</TableCell>
                    <TableCell>${Number(s.kpis?.adr ?? 0).toFixed(2)}</TableCell>
                    <TableCell>${Number(s.kpis?.revpar ?? 0).toFixed(2)}</TableCell>
                    <TableCell>{s.kpis?.active_members ?? 0}</TableCell>
                  </TableRow>
                ))}
                {snaps.length === 0 && <TableRow><TableCell colSpan={8} className="text-muted-foreground text-sm">No snapshots yet.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
