import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CHANNEL_LABELS, type Channel } from "@/hooks/useChannelManager";
import { toast } from "sonner";

interface Props { channels: Channel[]; }

export function MappingsTab({ channels }: Props) {
  return (
    <div className="space-y-6">
      {channels.map((ch) => (
        <ChannelMappings key={ch.id} channel={ch} />
      ))}
    </div>
  );
}

function ChannelMappings({ channel }: { channel: Channel }) {
  const [siteTypes, setSiteTypes] = useState<any[]>([]);
  const [rates, setRates] = useState<any[]>([]);
  const [siteMappings, setSiteMappings] = useState<Record<string, any>>({});
  const [rateMappings, setRateMappings] = useState<Record<string, any>>({});

  async function load() {
    const [st, rt, sm, rm] = await Promise.all([
      supabase.from("site_types").select("id,name").eq("property_id", channel.property_id).order("name"),
      supabase.from("rates").select("id,rate_code,description").eq("property_id", channel.property_id).order("rate_code"),
      supabase.from("channel_site_type_mappings").select("*").eq("channel_id", channel.id),
      supabase.from("channel_rate_mappings").select("*").eq("channel_id", channel.id),
    ]);
    setSiteTypes(st.data ?? []);
    setRates(rt.data ?? []);
    setSiteMappings(Object.fromEntries((sm.data ?? []).map((m) => [m.site_type_id, m])));
    setRateMappings(Object.fromEntries((rm.data ?? []).map((m) => [m.rate_id, m])));
  }
  useEffect(() => { load(); }, [channel.id]);

  async function upsertSiteMapping(siteTypeId: string, patch: any) {
    const existing = siteMappings[siteTypeId];
    if (existing) {
      const { error } = await supabase.from("channel_site_type_mappings").update(patch).eq("id", existing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("channel_site_type_mappings").insert({
        channel_id: channel.id, property_id: channel.property_id, site_type_id: siteTypeId,
        external_room_type_code: patch.external_room_type_code ?? "", is_active: patch.is_active ?? true,
      });
      if (error) return toast.error(error.message);
    }
    load();
  }

  async function upsertRateMapping(rateId: string, patch: any) {
    const existing = rateMappings[rateId];
    if (existing) {
      const { error } = await supabase.from("channel_rate_mappings").update(patch).eq("id", existing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("channel_rate_mappings").insert({
        channel_id: channel.id, property_id: channel.property_id, rate_id: rateId,
        external_rate_plan_code: patch.external_rate_plan_code ?? "", is_active: patch.is_active ?? true,
      });
      if (error) return toast.error(error.message);
    }
    load();
  }

  return (
    <Card>
      <CardHeader><CardTitle>{CHANNEL_LABELS[channel.channel_code]} — Mappings</CardTitle></CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h4 className="font-medium mb-2">Site Types</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Site Type</TableHead>
                <TableHead>OTA Room Type Code</TableHead>
                <TableHead>OTA Room Type Name</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {siteTypes.map((st) => {
                const m = siteMappings[st.id];
                return (
                  <TableRow key={st.id}>
                    <TableCell>{st.name}</TableCell>
                    <TableCell>
                      <Input defaultValue={m?.external_room_type_code ?? ""}
                        onBlur={(e) => upsertSiteMapping(st.id, { external_room_type_code: e.target.value })} />
                    </TableCell>
                    <TableCell>
                      <Input defaultValue={m?.external_room_type_name ?? ""}
                        onBlur={(e) => upsertSiteMapping(st.id, { external_room_type_name: e.target.value })} />
                    </TableCell>
                    <TableCell>
                      <Switch checked={m?.is_active ?? false}
                        onCheckedChange={(v) => upsertSiteMapping(st.id, { is_active: v })} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <div>
          <h4 className="font-medium mb-2">Rate Plans</h4>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rate</TableHead>
                <TableHead>OTA Rate Plan Code</TableHead>
                <TableHead>Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rates.map((r) => {
                const m = rateMappings[r.id];
                return (
                  <TableRow key={r.id}>
                    <TableCell>{r.rate_code} <span className="text-muted-foreground">{r.description}</span></TableCell>
                    <TableCell>
                      <Input defaultValue={m?.external_rate_plan_code ?? ""}
                        onBlur={(e) => upsertRateMapping(r.id, { external_rate_plan_code: e.target.value })} />
                    </TableCell>
                    <TableCell>
                      <Switch checked={m?.is_active ?? false}
                        onCheckedChange={(v) => upsertRateMapping(r.id, { is_active: v })} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
