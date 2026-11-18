import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Upload } from "lucide-react";
import { CHANNEL_LABELS, type Channel } from "@/hooks/useChannelManager";
import { toast } from "sonner";

export function ContentTab({ channels }: { channels: Channel[] }) {
  return (
    <div className="space-y-6">
      {channels.map((ch) => <ChannelContent key={ch.id} channel={ch} />)}
    </div>
  );
}

function ChannelContent({ channel }: { channel: Channel }) {
  const [siteTypes, setSiteTypes] = useState<any[]>([]);
  const [selectedSiteTypeId, setSelectedSiteTypeId] = useState<string>("");
  const [content, setContent] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  async function loadSiteTypes() {
    const { data } = await supabase.from("site_types").select("id,name")
      .eq("property_id", channel.property_id).order("name");
    setSiteTypes(data ?? []);

    if (!selectedSiteTypeId && data?.length) setSelectedSiteTypeId(data[0].id);
  }
  async function loadContent() {
    if (!selectedSiteTypeId) return;
    const { data } = await supabase.from("channel_content").select("*")
      .eq("channel_id", channel.id).eq("site_type_id", selectedSiteTypeId).maybeSingle();
    const st = siteTypes.find((s) => s.id === selectedSiteTypeId);
    setContent(data ?? {
      channel_id: channel.id, property_id: channel.property_id, site_type_id: selectedSiteTypeId,
      display_name: st?.name ?? "", short_description: "", long_description: "",
      max_occupancy: null, amenities: {}, policies: {}, gallery_asset_ids: [],
      push_status: "draft", last_pushed_at: null,
    });

  }
  useEffect(() => { loadSiteTypes(); }, [channel.id]);
  useEffect(() => { loadContent(); }, [selectedSiteTypeId, siteTypes.length]);

  async function save() {
    if (!content) return;
    setSaving(true);
    const payload = { ...content };
    delete payload.id;
    if (content.id) {
      await supabase.from("channel_content").update(payload).eq("id", content.id);
    } else {
      await supabase.from("channel_content").insert(payload);
    }
    setSaving(false);
    toast.success("Content saved");
    loadContent();
  }

  async function pushNow() {
    await save();
    const { data, error } = await supabase.functions.invoke("channel-content-push", {
      body: { channel_id: channel.id, site_type_id: selectedSiteTypeId },
    });
    if (error) return toast.error(error.message);
    if ((data as any)?.ok) toast.success((data as any).mocked ? "Content pushed (mock)" : "Content pushed");
    else toast.error("Content push failed");
    loadContent();
  }

  if (!content) {
    return (
      <Card>
        <CardHeader><CardTitle>{CHANNEL_LABELS[channel.channel_code]} — Content</CardTitle></CardHeader>
        <CardContent className="text-muted-foreground">No site types yet.</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{CHANNEL_LABELS[channel.channel_code]} — Content</CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={content.push_status === "synced" ? "default" : "secondary"}>{content.push_status ?? "draft"}</Badge>
            {content.last_pushed_at && (
              <span className="text-xs text-muted-foreground">
                pushed {new Date(content.last_pushed_at).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Site Type</Label>
          <Select value={selectedSiteTypeId} onValueChange={setSelectedSiteTypeId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {siteTypes.map((st) => <SelectItem key={st.id} value={st.id}>{st.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Display name</Label>
            <Input value={content.display_name ?? ""}
              onChange={(e) => setContent({ ...content, display_name: e.target.value })} />
          </div>
          <div>
            <Label>Max occupancy</Label>
            <Input type="number" value={content.max_occupancy ?? ""}
              onChange={(e) => setContent({ ...content, max_occupancy: Number(e.target.value) || null })} />
          </div>
        </div>

        <div>
          <Label>Short description</Label>
          <Textarea rows={2} value={content.short_description ?? ""}
            onChange={(e) => setContent({ ...content, short_description: e.target.value })} />
        </div>
        <div>
          <Label>Long description</Label>
          <Textarea rows={5} value={content.long_description ?? ""}
            onChange={(e) => setContent({ ...content, long_description: e.target.value })} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Amenities (JSON)</Label>
            <Textarea rows={4}
              value={JSON.stringify(content.amenities ?? {}, null, 2)}
              onChange={(e) => {
                try { setContent({ ...content, amenities: JSON.parse(e.target.value || "{}") }); } catch { /* ignore */ }
              }} />
          </div>
          <div>
            <Label>Policies (JSON)</Label>
            <Textarea rows={4}
              value={JSON.stringify(content.policies ?? {}, null, 2)}
              onChange={(e) => {
                try { setContent({ ...content, policies: JSON.parse(e.target.value || "{}") }); } catch { /* ignore */ }
              }} />
          </div>
        </div>

        {content.last_error && <div className="text-sm text-destructive">Last error: {content.last_error}</div>}

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={save} disabled={saving}>Save draft</Button>
          <Button onClick={pushNow} className="gap-2"><Upload className="h-4 w-4" /> Save & push to channel</Button>
        </div>
      </CardContent>
    </Card>
  );
}
