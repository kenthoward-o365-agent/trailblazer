import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Incident = {
  id: string;
  title: string;
  status: "investigating" | "identified" | "monitoring" | "resolved";
  severity: "minor" | "major" | "critical" | "maintenance";
  affected_components: string[];
  started_at: string;
  resolved_at: string | null;
  summary: string | null;
};

const empty: Partial<Incident> = { title: "", status: "investigating", severity: "minor", affected_components: [], summary: "" };

export default function StatusIncidentsAdmin() {
  const [items, setItems] = useState<Incident[]>([]);
  const [draft, setDraft] = useState<Partial<Incident>>(empty);
  const [saving, setSaving] = useState(false);

  const load = () => supabase.from("service_status_incidents").select("*").order("started_at", { ascending: false })
    .then(({ data }) => setItems((data ?? []) as Incident[]));

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!draft.title) return toast.error("Title required");
    setSaving(true);
    const { error } = await supabase.from("service_status_incidents").insert({
      title: draft.title!,
      status: draft.status!,
      severity: draft.severity!,
      affected_components: draft.affected_components ?? [],
      summary: draft.summary ?? null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Incident posted"); setDraft(empty); load();
  };

  const setStatus = async (id: string, status: Incident["status"]) => {
    const patch: any = { status };
    if (status === "resolved") patch.resolved_at = new Date().toISOString();
    const { error } = await supabase.from("service_status_incidents").update(patch).eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Status Page Incidents</h1>
        <p className="text-muted-foreground">Publish uptime and incident updates to the public status page.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>New Incident</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Title</Label><Input value={draft.title ?? ""} onChange={e => setDraft({ ...draft, title: e.target.value })} /></div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Status</Label>
              <Select value={draft.status} onValueChange={v => setDraft({ ...draft, status: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="investigating">Investigating</SelectItem>
                  <SelectItem value="identified">Identified</SelectItem>
                  <SelectItem value="monitoring">Monitoring</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Severity</Label>
              <Select value={draft.severity} onValueChange={v => setDraft({ ...draft, severity: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="minor">Minor</SelectItem>
                  <SelectItem value="major">Major</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Components (comma separated)</Label>
              <Input value={(draft.affected_components ?? []).join(", ")}
                onChange={e => setDraft({ ...draft, affected_components: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })} />
            </div>
          </div>
          <div><Label>Summary</Label><Textarea value={draft.summary ?? ""} onChange={e => setDraft({ ...draft, summary: e.target.value })} /></div>
          <Button onClick={create} disabled={saving}>{saving ? "Posting…" : "Post Incident"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Incidents</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {items.length === 0 && <p className="text-muted-foreground">No incidents recorded.</p>}
          {items.map(i => (
            <div key={i.id} className="rounded border p-3">
              <div className="flex justify-between items-start gap-3">
                <div>
                  <div className="font-semibold">{i.title}</div>
                  <div className="text-xs text-muted-foreground">{new Date(i.started_at).toLocaleString()}{i.resolved_at ? ` – resolved ${new Date(i.resolved_at).toLocaleString()}` : ""}</div>
                  {i.summary && <div className="text-sm mt-1">{i.summary}</div>}
                  <div className="flex gap-2 mt-2 flex-wrap">
                    <Badge variant={i.status === "resolved" ? "secondary" : "default"}>{i.status}</Badge>
                    <Badge variant="outline">{i.severity}</Badge>
                    {i.affected_components.map(c => <Badge key={c} variant="outline">{c}</Badge>)}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  {["investigating","identified","monitoring","resolved"].filter(s => s !== i.status).map(s => (
                    <Button key={s} size="sm" variant="outline" onClick={() => setStatus(i.id, s as any)}>{s}</Button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
