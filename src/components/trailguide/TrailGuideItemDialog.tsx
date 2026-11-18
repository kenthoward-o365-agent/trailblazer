import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Play } from "lucide-react";

type Item = any;
interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  propertyId: string;
  item?: Item | null;
  onSaved?: () => void;
}

const CHANNELS = ["in_app", "email", "sms"] as const;
const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

export function TrailGuideItemDialog({ open, onOpenChange, propertyId, item, onSaved }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isEdit = !!item;

  const [name, setName] = useState(item?.name || "");
  const [prompt, setPrompt] = useState(item?.prompt || "");
  const [scheduleType, setScheduleType] = useState<string>(item?.schedule_type || "on_demand");
  const [channels, setChannels] = useState<string[]>(item?.delivery_channels || ["in_app"]);
  const [requiresApproval, setRequiresApproval] = useState<boolean>(item?.requires_approval ?? true);
  const [recipients, setRecipients] = useState<string[]>([]);
  const [testing, setTesting] = useState(false);
  const [testOutput, setTestOutput] = useState<string>("");

  // preset schedule
  const cfg = item?.schedule_config || {};
  const [frequency, setFrequency] = useState<string>(cfg.frequency || "daily");
  const [hour, setHour] = useState<number>(cfg.hour ?? 9);
  const [minute, setMinute] = useState<number>(cfg.minute ?? 0);
  const [weekday, setWeekday] = useState<number>(cfg.weekday ?? 1);
  const [dayOfMonth, setDayOfMonth] = useState<number>(cfg.day_of_month ?? 1);
  const [cronExpr, setCronExpr] = useState<string>(cfg.expression || "0 9 * * *");

  const { data: staff = [] } = useQuery({
    queryKey: ["staff_for_property", propertyId],
    queryFn: async () => {
      const { data: access } = await supabase
        .from("user_property_access")
        .select("user_id")
        .eq("property_id", propertyId);
      const ids = Array.from(new Set((access || []).map((r: any) => r.user_id)));
      if (!ids.length) return [];
      const { data: profs } = await supabase
        .from("staff_profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", ids);
      const map = new Map((profs || []).map((p: any) => [p.user_id, p]));
      return ids.map((uid) => {
        const p: any = map.get(uid);
        return {
          user_id: uid,
          name: p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() || uid.slice(0, 8) : uid.slice(0, 8),
        };
      });
    },
  });

  useEffect(() => {
    if (!item) return;
    (async () => {
      const { data } = await supabase
        .from("trailguide_item_recipients")
        .select("user_id")
        .eq("item_id", item.id);
      setRecipients((data || []).map((r) => r.user_id));
    })();
  }, [item?.id]);

  function scheduleConfig() {
    if (scheduleType === "preset") {
      const base: any = { frequency, hour, minute };
      if (frequency === "weekly") base.weekday = weekday;
      if (frequency === "monthly") base.day_of_month = dayOfMonth;
      return base;
    }
    if (scheduleType === "cron") return { expression: cronExpr };
    return {};
  }

  function nextRunAt(): string | null {
    if (scheduleType === "on_demand") return null;
    // Kick off within a minute; dispatcher will recompute the next slot.
    const d = new Date();
    d.setSeconds(0, 0);
    d.setMinutes(d.getMinutes() + 1);
    return d.toISOString();
  }

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const payload: any = {
        property_id: propertyId,
        created_by_user_id: user?.id,
        name,
        prompt,
        schedule_type: scheduleType,
        schedule_config: scheduleConfig(),
        delivery_channels: channels,
        requires_approval: requiresApproval,
        is_active: true,
        next_run_at: nextRunAt(),
      };

      let id = item?.id;
      if (isEdit) {
        delete payload.created_by_user_id;
        const { error } = await supabase.from("trailguide_items").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("trailguide_items").insert(payload).select("id").single();
        if (error) throw error;
        id = data.id;
      }

      // Sync recipients
      await supabase.from("trailguide_item_recipients").delete().eq("item_id", id);
      if (recipients.length) {
        await supabase.from("trailguide_item_recipients").insert(
          recipients.map((uid) => ({ item_id: id, user_id: uid }))
        );
      }
    },
    onSuccess: () => {
      toast({ title: isEdit ? "Item updated" : "Item created" });
      onSaved?.();
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  async function testNow() {
    if (!prompt.trim()) return;
    setTesting(true);
    setTestOutput("");
    try {
      // Create a temp item? Instead call trailguide-item-run only if saved.
      // For unsaved test, call trailguide-chat directly via a temp path.
      const { data, error } = await supabase.functions.invoke("trailguide-chat", {
        body: {
          messages: [{ role: "user", content: prompt }],
          propertyId,
          auditDate: new Date().toISOString().slice(0, 10),
        },
      });
      if (error) throw error;
      setTestOutput(data?.reply || "(no reply)");
    } catch (e: any) {
      setTestOutput(`Error: ${e.message}`);
    } finally {
      setTesting(false);
    }
  }

  const toggleChannel = (c: string) =>
    setChannels((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  const toggleRecipient = (uid: string) =>
    setRecipients((prev) => (prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit TrailGuide Item" : "New TrailGuide Item"}</DialogTitle>
          <DialogDescription>
            Describe what TrailGuide should do, when it should run, and who receives the result.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Daily arrivals text" />
          </div>

          <div>
            <Label>Prompt</Label>
            <Textarea
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={`e.g. "List today's arrivals with site number and guest name."`}
            />
            <div className="flex justify-end mt-1">
              <Button size="sm" variant="outline" onClick={testNow} disabled={testing || !prompt.trim()}>
                {testing ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <Play className="w-3 h-3 mr-2" />}
                Test now
              </Button>
            </div>
            {testOutput && (
              <pre className="mt-2 p-3 bg-muted rounded text-xs whitespace-pre-wrap max-h-56 overflow-y-auto">
                {testOutput}
              </pre>
            )}
          </div>

          <div>
            <Label>Schedule</Label>
            <Tabs value={scheduleType} onValueChange={setScheduleType} className="mt-1">
              <TabsList>
                <TabsTrigger value="on_demand">On demand</TabsTrigger>
                <TabsTrigger value="preset">Preset</TabsTrigger>
                <TabsTrigger value="cron">Cron</TabsTrigger>
              </TabsList>
              <TabsContent value="on_demand" className="text-sm text-muted-foreground">
                Only runs when triggered manually.
              </TabsContent>
              <TabsContent value="preset" className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Frequency</Label>
                    <Select value={frequency} onValueChange={setFrequency}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label className="text-xs">Hour (UTC)</Label>
                      <Input type="number" min={0} max={23} value={hour} onChange={(e) => setHour(Number(e.target.value))} />
                    </div>
                    <div className="flex-1">
                      <Label className="text-xs">Minute</Label>
                      <Input type="number" min={0} max={59} value={minute} onChange={(e) => setMinute(Number(e.target.value))} />
                    </div>
                  </div>
                  {frequency === "weekly" && (
                    <div className="col-span-2">
                      <Label className="text-xs">Day of week</Label>
                      <Select value={String(weekday)} onValueChange={(v) => setWeekday(Number(v))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {WEEKDAYS.map((w, i) => <SelectItem key={i} value={String(i)}>{w}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {frequency === "monthly" && (
                    <div className="col-span-2">
                      <Label className="text-xs">Day of month (1-28)</Label>
                      <Input type="number" min={1} max={28} value={dayOfMonth} onChange={(e) => setDayOfMonth(Number(e.target.value))} />
                    </div>
                  )}
                </div>
              </TabsContent>
              <TabsContent value="cron">
                <Label className="text-xs">Cron expression (v1: naive parser — prefer Preset)</Label>
                <Input value={cronExpr} onChange={(e) => setCronExpr(e.target.value)} placeholder="0 9 * * *" />
              </TabsContent>
            </Tabs>
          </div>

          <div>
            <Label>Delivery channels</Label>
            <div className="flex gap-4 mt-2">
              {CHANNELS.map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={channels.includes(c)} onCheckedChange={() => toggleChannel(c)} />
                  {c === "in_app" ? "In-app" : c === "sms" ? "SMS" : "Email"}
                </label>
              ))}
            </div>
          </div>

          <div>
            <Label>Recipients (in addition to you)</Label>
            <div className="mt-2 max-h-40 overflow-y-auto border rounded p-2 space-y-1">
              {staff.length === 0 ? (
                <div className="text-xs text-muted-foreground">No other staff on this property.</div>
              ) : staff.map((s) => (
                <label key={s.user_id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={recipients.includes(s.user_id)}
                    onCheckedChange={() => toggleRecipient(s.user_id)}
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 border rounded">
            <div>
              <div className="font-medium text-sm">Require approval for actions</div>
              <div className="text-xs text-muted-foreground">
                If TrailGuide proposes changes (post charges, move sites, etc.), pause and notify for approval.
              </div>
            </div>
            <Switch checked={requiresApproval} onCheckedChange={setRequiresApproval} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => save.mutate()}
            disabled={save.isPending || !name.trim() || !prompt.trim() || channels.length === 0}
          >
            {save.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {isEdit ? "Save" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
