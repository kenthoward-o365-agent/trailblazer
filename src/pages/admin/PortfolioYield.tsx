import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, RefreshCcw } from "lucide-react";
import { toast } from "sonner";

interface Property { id: string; name: string; brand_id: string | null; region_id: string | null; }
interface Brand { id: string; name: string; }
interface Region { id: string; name: string; brand_id: string; }
interface Metric {
  property_id: string; stay_date: string;
  sites_available: number; sites_sold: number;
  occupancy_pct: number; adr: number; revpar: number;
  room_revenue: number; ancillary_revenue: number; total_revenue: number;
}

export default function PortfolioYield() {
  const [brands, setBrands] = useState<Brand[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [brandFilter, setBrandFilter] = useState("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(in30);
  const [loading, setLoading] = useState(false);

  useEffect(() => { loadRefs(); }, []);
  useEffect(() => { loadMetrics(); }, [from, to]);

  async function loadRefs() {
    const [b, r, p] = await Promise.all([
      supabase.from("brands").select("id,name").order("name"),
      supabase.from("regions").select("id,name,brand_id").order("name"),
      supabase.from("properties").select("id,name,brand_id,region_id").order("name"),
    ]);
    setBrands(b.data ?? []); setRegions(r.data ?? []); setProperties(p.data ?? []);
  }

  async function loadMetrics() {
    const { data, error } = await supabase.from("portfolio_metrics_daily")
      .select("*").gte("stay_date", from).lte("stay_date", to);
    if (error) return;
    setMetrics((data ?? []) as Metric[]);
  }

  const filteredProps = useMemo(() => properties.filter((p) =>
    (brandFilter === "all" || p.brand_id === brandFilter) &&
    (regionFilter === "all" || p.region_id === regionFilter)
  ), [properties, brandFilter, regionFilter]);

  const rollup = useMemo(() => {
    const byProperty = new Map<string, { rev: number; sold: number; avail: number; days: number }>();
    for (const m of metrics) {
      if (!filteredProps.find((p) => p.id === m.property_id)) continue;
      const cur = byProperty.get(m.property_id) ?? { rev: 0, sold: 0, avail: 0, days: 0 };
      cur.rev += Number(m.total_revenue);
      cur.sold += Number(m.sites_sold);
      cur.avail += Number(m.sites_available);
      cur.days += 1;
      byProperty.set(m.property_id, cur);
    }
    return Array.from(byProperty.entries()).map(([pid, v]) => {
      const prop = properties.find((p) => p.id === pid);
      const occ = v.avail > 0 ? (v.sold / v.avail) * 100 : 0;
      const adr = v.sold > 0 ? v.rev / v.sold : 0;
      const revpar = v.avail > 0 ? v.rev / v.avail : 0;
      return { pid, name: prop?.name ?? pid, occ, adr, revpar, rev: v.rev };
    }).sort((a, b) => b.rev - a.rev);
  }, [metrics, filteredProps, properties]);

  const totals = useMemo(() => {
    const totalRev = rollup.reduce((s, r) => s + r.rev, 0);
    const avgOcc = rollup.length ? rollup.reduce((s, r) => s + r.occ, 0) / rollup.length : 0;
    const avgAdr = rollup.length ? rollup.reduce((s, r) => s + r.adr, 0) / rollup.length : 0;
    const avgRevpar = rollup.length ? rollup.reduce((s, r) => s + r.revpar, 0) / rollup.length : 0;
    return { totalRev, avgOcc, avgAdr, avgRevpar };
  }, [rollup]);

  async function refresh() {
    if (filteredProps.length === 0) return toast.error("No properties to refresh");
    setLoading(true);
    const { error } = await supabase.functions.invoke("portfolio-metrics-refresh", {
      body: { property_ids: filteredProps.map((p) => p.id), from_date: from, to_date: to },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Metrics refreshed");
    loadMetrics();
  }

  const compressionAlerts = rollup.filter((r) => r.occ >= 85);

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><TrendingUp className="h-7 w-7" /> Portfolio Yield</h1>
            <p className="text-muted-foreground">Occupancy, ADR, and RevPAR across brands, regions, and parks.</p>
          </div>
          <Button onClick={refresh} disabled={loading}>
            <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh rollup
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-5 gap-3">
            <div><Label>Brand</Label>
              <Select value={brandFilter} onValueChange={setBrandFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All brands</SelectItem>
                  {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Region</Label>
              <Select value={regionFilter} onValueChange={setRegionFilter}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All regions</SelectItem>
                  {regions.filter(r => brandFilter === "all" || r.brand_id === brandFilter).map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <div className="flex items-end text-sm text-muted-foreground">{filteredProps.length} parks · {metrics.length} rows</div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Total revenue" value={`$${totals.totalRev.toFixed(0)}`} />
          <Kpi label="Avg occupancy" value={`${totals.avgOcc.toFixed(1)}%`} />
          <Kpi label="Avg ADR" value={`$${totals.avgAdr.toFixed(2)}`} />
          <Kpi label="Avg RevPAR" value={`$${totals.avgRevpar.toFixed(2)}`} />
        </div>

        {compressionAlerts.length > 0 && (
          <Card className="border-amber-500/50">
            <CardHeader><CardTitle className="text-amber-700 dark:text-amber-400">Compression alerts</CardTitle></CardHeader>
            <CardContent className="text-sm">
              {compressionAlerts.length} park{compressionAlerts.length === 1 ? "" : "s"} above 85% occupancy — consider a rate lift.
              <ul className="mt-2 list-disc pl-5">
                {compressionAlerts.map((a) => <li key={a.pid}>{a.name} — {a.occ.toFixed(1)}%</li>)}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>Per-property performance</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Property</TableHead>
                  <TableHead>Occupancy</TableHead>
                  <TableHead>ADR</TableHead>
                  <TableHead>RevPAR</TableHead>
                  <TableHead>Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rollup.map((r) => (
                  <TableRow key={r.pid}>
                    <TableCell>{r.name}</TableCell>
                    <TableCell>{r.occ.toFixed(1)}%</TableCell>
                    <TableCell>${r.adr.toFixed(2)}</TableCell>
                    <TableCell>${r.revpar.toFixed(2)}</TableCell>
                    <TableCell>${r.rev.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {rollup.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-muted-foreground text-sm">
                    No metrics yet. Click "Refresh rollup" to compute.
                  </TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card><CardContent className="pt-6">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </CardContent></Card>
  );
}
