import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Wrench } from "lucide-react";
import { toast } from "sonner";

interface Region { id: string; name: string; }
interface Property { id: string; name: string; region_id: string | null; }
interface PoolItem {
  id: string; region_id: string; work_order_id: string; property_id: string;
  dispatched_to_user_id: string | null; sla_hours: number | null; travel_minutes: number | null;
  status: string; created_at: string;
}
interface OpenWo { id: string; wo_number: string | null; title: string; property_id: string; priority: string | null; status: string; }

export default function RegionalOps() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [regionId, setRegionId] = useState<string>("");
  const [items, setItems] = useState<PoolItem[]>([]);
  const [openWos, setOpenWos] = useState<OpenWo[]>([]);
  const [selectedWo, setSelectedWo] = useState("");
  const [sla, setSla] = useState<string>("");
  const [travel, setTravel] = useState<string>("");

  useEffect(() => {
    (async () => {
      const [r, p] = await Promise.all([
        supabase.from("regions").select("id,name").order("name"),
        supabase.from("properties").select("id,name,region_id").order("name"),
      ]);
      setRegions(r.data ?? []); setProperties(p.data ?? []);
      if (r.data && r.data.length) setRegionId(r.data[0].id);
    })();
  }, []);

  useEffect(() => { if (regionId) load(); }, [regionId]);

  async function load() {
    const regionProps = properties.filter((p) => p.region_id === regionId).map((p) => p.id);
    const [pool, wos] = await Promise.all([
      supabase.from("regional_work_order_pool").select("*").eq("region_id", regionId).order("created_at", { ascending: false }),
      regionProps.length
        ? supabase.from("work_orders").select("id,wo_number,title,property_id,priority,status")
            .in("property_id", regionProps).in("status", ["open", "in_progress"]).order("created_at", { ascending: false }).limit(100)
        : Promise.resolve({ data: [] as any }),
    ]);
    setItems((pool.data ?? []) as PoolItem[]);
    const alreadyPooled = new Set((pool.data ?? []).map((r: any) => r.work_order_id));
    setOpenWos(((wos.data ?? []) as OpenWo[]).filter((w) => !alreadyPooled.has(w.id)));
  }

  async function queue() {
    if (!selectedWo) return toast.error("Pick a work order");
    const wo = openWos.find((w) => w.id === selectedWo);
    if (!wo) return;
    const { error } = await supabase.from("regional_work_order_pool").insert({
      region_id: regionId,
      work_order_id: wo.id,
      property_id: wo.property_id,
      sla_hours: sla ? Number(sla) : null,
      travel_minutes: travel ? Number(travel) : null,
    });
    if (error) return toast.error(error.message);
    setSelectedWo(""); setSla(""); setTravel(""); load();
  }

  async function updateStatus(id: string, status: string) {
    const patch: any = { status };
    if (status === "dispatched") patch.dispatched_at = new Date().toISOString();
    if (status === "completed") patch.completed_at = new Date().toISOString();
    const { error } = await supabase.from("regional_work_order_pool").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  const propName = (id: string) => properties.find((p) => p.id === id)?.name ?? id.slice(0, 6);

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Wrench className="h-7 w-7" /> Regional Ops</h1>
          <p className="text-muted-foreground">Route work orders across parks in a region, with SLA and travel-time hints.</p>
        </div>

        <Card>
          <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-4 gap-3">
            <div><Label>Region</Label>
              <Select value={regionId} onValueChange={setRegionId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{regions.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Open work order</Label>
              <Select value={selectedWo} onValueChange={setSelectedWo}>
                <SelectTrigger><SelectValue placeholder="Pick" /></SelectTrigger>
                <SelectContent>
                  {openWos.map((w) => (
                    <SelectItem key={w.id} value={w.id}>{w.wo_number ?? w.id.slice(0, 6)} · {w.title} · {propName(w.property_id)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>SLA (hours)</Label><Input type="number" value={sla} onChange={(e) => setSla(e.target.value)} /></div>
            <div className="flex items-end gap-2">
              <div className="flex-1"><Label>Travel (min)</Label><Input type="number" value={travel} onChange={(e) => setTravel(e.target.value)} /></div>
              <Button onClick={queue}>Add to pool</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Regional pool</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Created</TableHead><TableHead>Property</TableHead>
                <TableHead>SLA</TableHead><TableHead>Travel</TableHead>
                <TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {items.map((it) => (
                  <TableRow key={it.id}>
                    <TableCell>{new Date(it.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>{propName(it.property_id)}</TableCell>
                    <TableCell>{it.sla_hours ? `${it.sla_hours}h` : "—"}</TableCell>
                    <TableCell>{it.travel_minutes ? `${it.travel_minutes}m` : "—"}</TableCell>
                    <TableCell><Badge variant="outline">{it.status}</Badge></TableCell>
                    <TableCell className="text-right space-x-1">
                      {it.status === "queued" && <Button size="sm" onClick={() => updateStatus(it.id, "dispatched")}>Dispatch</Button>}
                      {it.status === "dispatched" && <Button size="sm" onClick={() => updateStatus(it.id, "in_progress")}>Start</Button>}
                      {it.status === "in_progress" && <Button size="sm" onClick={() => updateStatus(it.id, "completed")}>Complete</Button>}
                    </TableCell>
                  </TableRow>
                ))}
                {items.length === 0 && <TableRow><TableCell colSpan={6} className="text-muted-foreground text-sm">Pool empty.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
