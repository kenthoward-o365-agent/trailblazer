import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

type Org = { id: string; name: string };
type Quota = {
  organization_id: string;
  daily_request_limit: number;
  burst_per_minute: number;
  booking_engine_daily_limit: number;
};
type Usage = { usage_date: string; request_count: number; booking_engine_count: number; throttled_count: number };

export default function ApiQuotas() {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgId, setOrgId] = useState<string>("");
  const [q, setQ] = useState<Quota | null>(null);
  const [usage, setUsage] = useState<Usage[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("organizations").select("id,name").order("name").then(({ data }) => {
      setOrgs(data ?? []);
      if (data?.[0]) setOrgId(data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!orgId) return;
    supabase.from("org_api_quotas").select("*").eq("organization_id", orgId).maybeSingle()
      .then(({ data }) => setQ(data as Quota ?? {
        organization_id: orgId, daily_request_limit: 100000, burst_per_minute: 600, booking_engine_daily_limit: 50000,
      }));
    supabase.from("api_quota_usage").select("usage_date,request_count,booking_engine_count,throttled_count")
      .eq("organization_id", orgId).order("usage_date", { ascending: false }).limit(14)
      .then(({ data }) => setUsage((data ?? []) as Usage[]));
  }, [orgId]);

  const save = async () => {
    if (!q) return;
    setSaving(true);
    const { error } = await supabase.from("org_api_quotas").upsert(q);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Quotas updated");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">API Quotas</h1>
        <p className="text-muted-foreground">Per-organization limits on API and booking engine traffic.</p>
      </div>

      <div className="max-w-md">
        <Label>Organization</Label>
        <Select value={orgId} onValueChange={setOrgId}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{orgs.map(o => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      {q && (
        <Card>
          <CardHeader><CardTitle>Limits</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            <div><Label>Daily requests</Label><Input type="number" value={q.daily_request_limit} onChange={e => setQ({ ...q, daily_request_limit: +e.target.value })} /></div>
            <div><Label>Burst / min</Label><Input type="number" value={q.burst_per_minute} onChange={e => setQ({ ...q, burst_per_minute: +e.target.value })} /></div>
            <div><Label>Booking engine daily</Label><Input type="number" value={q.booking_engine_daily_limit} onChange={e => setQ({ ...q, booking_engine_daily_limit: +e.target.value })} /></div>
            <div className="col-span-3"><Button onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</Button></div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle>Recent Usage (14 days)</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Requests</TableHead><TableHead>Booking Engine</TableHead><TableHead>Throttled</TableHead></TableRow></TableHeader>
            <TableBody>
              {usage.length === 0 && <TableRow><TableCell colSpan={4} className="text-muted-foreground">No usage recorded yet.</TableCell></TableRow>}
              {usage.map(u => (
                <TableRow key={u.usage_date}>
                  <TableCell>{u.usage_date}</TableCell>
                  <TableCell>{u.request_count.toLocaleString()}</TableCell>
                  <TableCell>{u.booking_engine_count.toLocaleString()}</TableCell>
                  <TableCell>{u.throttled_count.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
