import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useProperty } from "@/contexts/PropertyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, MessageSquare, BookOpen, Phone, Mail, Facebook, Instagram } from "lucide-react";
import { toast } from "sonner";
import { KnowledgeImporter } from "@/components/messaging/KnowledgeImporter";

type Kb = {
  id: string;
  category: string;
  title: string;
  body: string;
  tags: string[];
  is_active: boolean;
};

type Channel = {
  id: string;
  channel: string;
  provider: string;
  identifier: string;
  is_active: boolean;
};

const CATEGORIES = ["policy", "amenity", "faq", "rental_catalog", "hours", "rules", "other"];

export default function GuestMessagingSettings() {
  const { selectedProperty } = useProperty();
  const [kb, setKb] = useState<Kb[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Kb> | null>(null);
  const [chDialog, setChDialog] = useState(false);
  const [newCh, setNewCh] = useState<Partial<Channel>>({ channel: "sms", provider: "twilio", is_active: true });

  const load = async () => {
    if (!selectedProperty?.id) return;
    const [k, c] = await Promise.all([
      supabase
        .from("messaging_ai_knowledge")
        .select("*")
        .eq("property_id", selectedProperty.id)
        .order("category")
        .order("title"),
      supabase.from("messaging_channels").select("*").eq("property_id", selectedProperty.id),
    ]);
    setKb((k.data || []) as Kb[]);
    setChannels((c.data || []) as Channel[]);
  };

  useEffect(() => {
    load();
  }, [selectedProperty?.id]);

  const saveKb = async () => {
    if (!editing || !selectedProperty?.id) return;
    if (!editing.title || !editing.body) {
      toast.error("Title and body are required");
      return;
    }
    const payload = {
      property_id: selectedProperty.id,
      category: editing.category || "faq",
      title: editing.title,
      body: editing.body,
      tags: editing.tags || [],
      is_active: editing.is_active ?? true,
    };
    let err;
    if (editing.id) {
      ({ error: err } = await supabase.from("messaging_ai_knowledge").update(payload).eq("id", editing.id));
    } else {
      ({ error: err } = await supabase.from("messaging_ai_knowledge").insert(payload));
    }
    if (err) {
      toast.error(err.message);
      return;
    }
    toast.success("Saved");
    setDialogOpen(false);
    setEditing(null);
    load();
  };

  const deleteKb = async (id: string) => {
    if (!confirm("Delete this knowledge entry?")) return;
    const { error } = await supabase.from("messaging_ai_knowledge").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  const toggleKb = async (item: Kb) => {
    await supabase.from("messaging_ai_knowledge").update({ is_active: !item.is_active }).eq("id", item.id);
    load();
  };

  const saveChannel = async () => {
    if (!selectedProperty?.id || !newCh.identifier) {
      toast.error("Identifier required");
      return;
    }
    const { error } = await supabase.from("messaging_channels").insert({
      property_id: selectedProperty.id,
      channel: newCh.channel!,
      provider: newCh.provider!,
      identifier: newCh.identifier!,
      is_active: newCh.is_active ?? true,
    });
    if (error) return toast.error(error.message);
    setChDialog(false);
    setNewCh({ channel: "sms", provider: "twilio", is_active: true });
    load();
  };

  const deleteChannel = async (id: string) => {
    if (!confirm("Remove this channel?")) return;
    await supabase.from("messaging_channels").delete().eq("id", id);
    load();
  };

  const iconFor = (ch: string) =>
    ch === "sms" ? Phone : ch === "email" ? Mail : ch === "facebook" ? Facebook : ch === "instagram" ? Instagram : MessageSquare;

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-6xl">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <MessageSquare className="h-6 w-6" /> Guest Messaging Settings
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure channels and teach the AI concierge about your property.
          </p>
        </div>

        <Tabs defaultValue="knowledge">
          <TabsList>
            <TabsTrigger value="knowledge"><BookOpen className="h-4 w-4 mr-1" /> Guest AI Knowledge</TabsTrigger>
            <TabsTrigger value="channels"><MessageSquare className="h-4 w-4 mr-1" /> Channels</TabsTrigger>
          </TabsList>

          <TabsContent value="knowledge" className="space-y-3 mt-4">
            {selectedProperty?.id && (
              <KnowledgeImporter propertyId={selectedProperty.id} onImported={load} />
            )}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Property Knowledge</CardTitle>
                  <CardDescription>
                    The AI concierge reads these entries to answer guest questions. Add policies, amenity hours, WiFi info, pet rules, rental catalog, etc.
                  </CardDescription>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => setEditing({ category: "faq", is_active: true, tags: [] })}>
                      <Plus className="h-4 w-4 mr-1" /> Add Entry
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>{editing?.id ? "Edit" : "New"} Knowledge Entry</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div>
                        <Label>Category</Label>
                        <Select
                          value={editing?.category || "faq"}
                          onValueChange={(v) => setEditing((e) => ({ ...e, category: v }))}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Title</Label>
                        <Input
                          value={editing?.title || ""}
                          onChange={(e) => setEditing((s) => ({ ...s, title: e.target.value }))}
                          placeholder="e.g. Pool Hours"
                        />
                      </div>
                      <div>
                        <Label>Body</Label>
                        <Textarea
                          value={editing?.body || ""}
                          onChange={(e) => setEditing((s) => ({ ...s, body: e.target.value }))}
                          placeholder="Pool is open 9am–9pm daily. Closed for cleaning Wednesdays 8–9am."
                          className="min-h-[140px]"
                        />
                      </div>
                      <div>
                        <Label>Tags (comma-separated)</Label>
                        <Input
                          value={(editing?.tags || []).join(", ")}
                          onChange={(e) =>
                            setEditing((s) => ({ ...s, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) }))
                          }
                          placeholder="pool, hours, amenities"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={editing?.is_active ?? true}
                          onCheckedChange={(v) => setEditing((s) => ({ ...s, is_active: v }))}
                        />
                        <Label>Active</Label>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                      <Button onClick={saveKb}>Save</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {kb.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-8">
                    No knowledge entries yet. Add your first entry so the AI concierge can answer guest questions.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {kb.map((item) => (
                      <div key={item.id} className="border rounded-lg p-3 flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium">{item.title}</span>
                            <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
                            {!item.is_active && <Badge variant="secondary" className="text-[10px]">inactive</Badge>}
                          </div>
                          <div className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">
                            {item.body}
                          </div>
                          {item.tags?.length > 0 && (
                            <div className="flex gap-1 mt-1 flex-wrap">
                              {item.tags.map((t) => <span key={t} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{t}</span>)}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Switch checked={item.is_active} onCheckedChange={() => toggleKb(item)} />
                          <Button size="sm" variant="ghost" onClick={() => { setEditing(item); setDialogOpen(true); }}>
                            Edit
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteKb(item.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="channels" className="space-y-3 mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Messaging Channels</CardTitle>
                  <CardDescription>Configure inbound/outbound numbers and addresses for guest messaging.</CardDescription>
                </div>
                <Dialog open={chDialog} onOpenChange={setChDialog}>
                  <DialogTrigger asChild>
                    <Button><Plus className="h-4 w-4 mr-1" /> Add Channel</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>New Channel</DialogTitle></DialogHeader>
                    <div className="space-y-3">
                      <div>
                        <Label>Channel</Label>
                        <Select value={newCh.channel} onValueChange={(v) => {
                          const provider = v === "email" ? "resend" : v === "sms" ? "twilio" : "meta";
                          setNewCh({ ...newCh, channel: v, provider });
                        }}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="sms">SMS (Twilio)</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="facebook">Facebook Messenger</SelectItem>
                            <SelectItem value="instagram">Instagram DM</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Identifier</Label>
                        <Input
                          value={newCh.identifier || ""}
                          onChange={(e) => setNewCh({ ...newCh, identifier: e.target.value })}
                          placeholder={newCh.channel === "sms" ? "+15551234567" : newCh.channel === "email" ? "stay@yourdomain.com" : "Page or IG business ID"}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch checked={newCh.is_active ?? true} onCheckedChange={(v) => setNewCh({ ...newCh, is_active: v })} />
                        <Label>Active</Label>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setChDialog(false)}>Cancel</Button>
                      <Button onClick={saveChannel}>Save</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                {channels.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-8">
                    No channels configured yet. Add SMS, Email, or Meta channels to start receiving messages.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {channels.map((c) => {
                      const Icon = iconFor(c.channel);
                      return (
                        <div key={c.id} className="border rounded-lg p-3 flex items-center gap-3">
                          <Icon className="h-5 w-5 text-muted-foreground" />
                          <div className="flex-1">
                            <div className="font-medium">{c.identifier}</div>
                            <div className="text-xs text-muted-foreground">{c.channel} · {c.provider}</div>
                          </div>
                          {!c.is_active && <Badge variant="secondary">inactive</Badge>}
                          <Button size="sm" variant="ghost" onClick={() => deleteChannel(c.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="mt-4 p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground space-y-1">
                  <div><strong>SMS webhook:</strong> Point your Twilio number's messaging webhook to <code className="bg-background px-1 rounded">/functions/v1/messaging-twilio-webhook</code></div>
                  <div><strong>Email & Meta:</strong> Additional provider setup required. Contact support to complete configuration.</div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
