import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useProperty } from "@/contexts/PropertyContext";
import { useToast } from "@/hooks/use-toast";
import { Play, Plus, History, Trash2, Pencil, Loader2 } from "lucide-react";
import { TrailGuideItemDialog } from "@/components/trailguide/TrailGuideItemDialog";
import { TrailGuideRunsDrawer } from "@/components/trailguide/TrailGuideRunsDrawer";
import { formatDistanceToNow } from "date-fns";

export default function TrailGuideItems() {
  const { selectedProperty } = useProperty();
  const propertyId = selectedProperty?.id;
  const { toast } = useToast();
  const qc = useQueryClient();

  const [editing, setEditing] = useState<any | null>(null);
  const [showDialog, setShowDialog] = useState(false);
  const [runsFor, setRunsFor] = useState<any | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["trailguide_items", propertyId],
    enabled: !!propertyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trailguide_items")
        .select("*")
        .eq("property_id", propertyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("trailguide_items")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trailguide_items", propertyId] }),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trailguide_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Deleted" });
      qc.invalidateQueries({ queryKey: ["trailguide_items", propertyId] });
    },
  });

  async function runNow(item: any) {
    setRunningId(item.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke("trailguide-item-run", {
        body: { item_id: item.id, triggered_by: "manual", triggered_by_user_id: user?.id ?? null },
      });
      if (error) throw error;
      toast({
        title: data?.requires_approval ? "Waiting for approval" : "Run completed",
        description: data?.requires_approval ? "Open Runs to approve." : undefined,
      });
      qc.invalidateQueries({ queryKey: ["trailguide_items", propertyId] });
    } catch (e: any) {
      toast({ title: "Run failed", description: e.message, variant: "destructive" });
    } finally {
      setRunningId(null);
    }
  }

  const scheduleLabel = (item: any) => {
    if (item.schedule_type === "on_demand") return "On demand";
    if (item.schedule_type === "cron") return `Cron: ${item.schedule_config?.expression || "—"}`;
    const c = item.schedule_config || {};
    const time = `${String(c.hour ?? 9).padStart(2, "0")}:${String(c.minute ?? 0).padStart(2, "0")} UTC`;
    if (c.frequency === "weekly") return `Weekly (${["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][c.weekday ?? 1]}) ${time}`;
    if (c.frequency === "monthly") return `Monthly (day ${c.day_of_month ?? 1}) ${time}`;
    return `Daily ${time}`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold">TrailGuide Items</h1>
            <p className="text-muted-foreground">
              Saved TrailGuide jobs. Run on demand or on a schedule; results deliver via SMS, email, or in-app.
            </p>
          </div>
          <Button onClick={() => { setEditing(null); setShowDialog(true); }}>
            <Plus className="w-4 h-4 mr-2" /> New item
          </Button>
        </div>

        <Card className="p-0 overflow-hidden">
          {isLoading ? (
            <div className="p-6 text-muted-foreground">Loading…</div>
          ) : items.length === 0 ? (
            <div className="p-10 text-center text-muted-foreground">
              No TrailGuide items yet. Create one to automate reports and actions.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Schedule</th>
                  <th className="p-3">Channels</th>
                  <th className="p-3">Last run</th>
                  <th className="p-3">Active</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t">
                    <td className="p-3">
                      <div className="font-medium">{item.name}</div>
                      <div className="text-xs text-muted-foreground line-clamp-1 max-w-md">{item.prompt}</div>
                    </td>
                    <td className="p-3">{scheduleLabel(item)}</td>
                    <td className="p-3">
                      <div className="flex gap-1 flex-wrap">
                        {(item.delivery_channels || []).map((c: string) => (
                          <Badge key={c} variant="outline">{c}</Badge>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 text-xs">
                      {item.last_run_at ? (
                        <>
                          <div>{formatDistanceToNow(new Date(item.last_run_at), { addSuffix: true })}</div>
                          <Badge variant={item.last_status === "failed" ? "destructive" : "secondary"}>
                            {item.last_status}
                          </Badge>
                        </>
                      ) : "—"}
                    </td>
                    <td className="p-3">
                      <Switch
                        checked={item.is_active}
                        onCheckedChange={(v) => toggleActive.mutate({ id: item.id, is_active: v })}
                      />
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => runNow(item)} disabled={runningId === item.id}>
                          {runningId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setRunsFor(item)}>
                          <History className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(item); setShowDialog(true); }}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => {
                          if (confirm(`Delete "${item.name}"?`)) del.mutate(item.id);
                        }}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      {showDialog && propertyId && (
        <TrailGuideItemDialog
          open={showDialog}
          onOpenChange={setShowDialog}
          propertyId={propertyId}
          item={editing}
          onSaved={() => qc.invalidateQueries({ queryKey: ["trailguide_items", propertyId] })}
        />
      )}

      {runsFor && (
        <TrailGuideRunsDrawer
          item={runsFor}
          open={!!runsFor}
          onOpenChange={(o) => !o && setRunsFor(null)}
        />
      )}
    </DashboardLayout>
  );
}
