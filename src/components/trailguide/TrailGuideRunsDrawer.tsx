import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { Check, X, Loader2 } from "lucide-react";
import { useState } from "react";

interface Props {
  item: any;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  succeeded: "default",
  failed: "destructive",
  awaiting_approval: "secondary",
  rejected: "outline",
  running: "outline",
  queued: "outline",
};

export function TrailGuideRunsDrawer({ item, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const { data: runs = [], refetch } = useQuery({
    queryKey: ["trailguide_item_runs", item.id],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trailguide_item_runs")
        .select("*")
        .eq("item_id", item.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    refetchInterval: open ? 5000 : false,
  });

  async function decide(runId: string, decision: "approve" | "reject") {
    setDecidingId(runId);
    try {
      const { data, error } = await supabase.functions.invoke("trailguide-item-approve", {
        body: { run_id: runId, decision },
      });
      if (error) throw error;
      toast({ title: decision === "approve" ? "Approved & executed" : "Rejected" });
      refetch();
      qc.invalidateQueries({ queryKey: ["trailguide_items"] });
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setDecidingId(null);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Runs — {item.name}</SheetTitle>
          <SheetDescription>Last 50 executions</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {runs.length === 0 && (
            <div className="text-sm text-muted-foreground">No runs yet.</div>
          )}
          {runs.map((run: any) => (
            <div key={run.id} className="border rounded p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Badge variant={STATUS_VARIANT[run.status] || "outline"}>{run.status}</Badge>
                <div className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(run.created_at), { addSuffix: true })}
                  {" · "}{run.triggered_by}
                </div>
              </div>
              {run.output_text && (
                <pre className="text-xs whitespace-pre-wrap bg-muted p-2 rounded max-h-40 overflow-y-auto">
                  {run.output_text}
                </pre>
              )}
              {run.error && (
                <div className="text-xs text-destructive">Error: {run.error}</div>
              )}
              {(run.proposed_actions?.length ?? 0) > 0 && (
                <div className="text-xs">
                  <div className="font-medium mb-1">Proposed actions:</div>
                  <ul className="list-disc ml-4">
                    {run.proposed_actions.map((a: any, i: number) => (
                      <li key={i}><code>{a.tool}</code></li>
                    ))}
                  </ul>
                </div>
              )}
              {run.status === "awaiting_approval" && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => decide(run.id, "approve")} disabled={decidingId === run.id}>
                    {decidingId === run.id ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Check className="w-3 h-3 mr-1" />}
                    Approve & execute
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => decide(run.id, "reject")} disabled={decidingId === run.id}>
                    <X className="w-3 h-3 mr-1" /> Reject
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
