import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Plus } from "lucide-react";
import { CHANNEL_LABELS, type Channel } from "@/hooks/useChannelManager";
import { toast } from "sonner";

interface Rule {
  id?: string;
  channel_id: string;
  property_id: string;
  name: string;
  site_type_id: string | null;
  start_date: string | null;
  end_date: string | null;
  hold_type: "fixed" | "percent";
  hold_value: number;
  priority: number;
  is_active: boolean;
}

export function HoldbacksTab({ channels }: { channels: Channel[] }) {
  return (
    <div className="space-y-6">
      {channels.map((ch) => <ChannelHoldbacks key={ch.id} channel={ch} />)}
    </div>
  );
}

function ChannelHoldbacks({ channel }: { channel: Channel }) {
  const [siteTypes, setSiteTypes] = useState<any[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [draft, setDraft] = useState<Rule>(emptyRule(channel));

  async function load() {
    const [st, rl] = await Promise.all([
      supabase.from("site_types").select("id,name").eq("property_id", channel.property_id),
      supabase.from("channel_holdback_rules").select("*").eq("channel_id", channel.id).order("priority", { ascending: false }),
    ]);
    setSiteTypes(st.data ?? []);
    setRules((rl.data ?? []) as Rule[]);
  }
  useEffect(() => { load(); }, [channel.id]);

  async function addRule() {
    if (!draft.name) return toast.error("Name required");
    const { error } = await supabase.from("channel_holdback_rules").insert(draft);
    if (error) return toast.error(error.message);
    setDraft(emptyRule(channel));
    load();
  }
  async function removeRule(id: string) {
    await supabase.from("channel_holdback_rules").delete().eq("id", id);
    load();
  }
  async function updateRule(id: string, patch: Partial<Rule>) {
    await supabase.from("channel_holdback_rules").update(patch).eq("id", id);
    load();
  }

  return (
    <Card>
      <CardHeader><CardTitle>{CHANNEL_LABELS[channel.channel_code]} — Hold-Back Rules</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-7 gap-2 items-end p-3 border rounded-md bg-muted/30">
          <div className="col-span-2">
            <Label>Rule name</Label>
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Peak weekends" />
          </div>
          <div>
            <Label>Site type</Label>
            <Select value={draft.site_type_id ?? "all"} onValueChange={(v) => setDraft({ ...draft, site_type_id: v === "all" ? null : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {siteTypes.map((st) => <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Type</Label>
            <Select value={draft.hold_type} onValueChange={(v) => setDraft({ ...draft, hold_type: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fixed">Fixed</SelectItem>
                <SelectItem value="percent">Percent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Value</Label>
            <Input type="number" min={0} value={draft.hold_value}
              onChange={(e) => setDraft({ ...draft, hold_value: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Priority</Label>
            <Input type="number" value={draft.priority}
              onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })} />
          </div>
          <div>
            <Label>Start</Label>
            <Input type="date" value={draft.start_date ?? ""} onChange={(e) => setDraft({ ...draft, start_date: e.target.value || null })} />
          </div>
          <div>
            <Label>End</Label>
            <Input type="date" value={draft.end_date ?? ""} onChange={(e) => setDraft({ ...draft, end_date: e.target.value || null })} />
          </div>
          <div className="col-span-2 md:col-span-7 flex justify-end">
            <Button onClick={addRule} className="gap-2"><Plus className="h-4 w-4" /> Add rule</Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Site type</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Value</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Active</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rules.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No rules yet</TableCell></TableRow>
            )}
            {rules.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.name}</TableCell>
                <TableCell>{r.site_type_id ? siteTypes.find((s) => s.id === r.site_type_id)?.name ?? "—" : "All"}</TableCell>
                <TableCell>{r.hold_type}</TableCell>
                <TableCell>{r.hold_value}{r.hold_type === "percent" ? "%" : ""}</TableCell>
                <TableCell>{r.priority}</TableCell>
                <TableCell className="text-xs">{r.start_date ?? "—"} → {r.end_date ?? "—"}</TableCell>
                <TableCell>
                  <Switch checked={r.is_active} onCheckedChange={(v) => updateRule(r.id!, { is_active: v })} />
                </TableCell>
                <TableCell>
                  <Button size="icon" variant="ghost" onClick={() => removeRule(r.id!)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function emptyRule(channel: Channel): Rule {
  return {
    channel_id: channel.id,
    property_id: channel.property_id,
    name: "",
    site_type_id: null,
    start_date: null,
    end_date: null,
    hold_type: "fixed",
    hold_value: 0,
    priority: 100,
    is_active: true,
  };
}
