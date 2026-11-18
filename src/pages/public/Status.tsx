import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, Wrench } from "lucide-react";

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

export default function PublicStatus() {
  const [items, setItems] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("service_status_incidents").select("*")
      .order("started_at", { ascending: false }).limit(50)
      .then(({ data }) => { setItems((data ?? []) as Incident[]); setLoading(false); });
  }, []);

  const active = items.filter(i => i.status !== "resolved");
  const past = items.filter(i => i.status === "resolved");
  const allClear = !loading && active.length === 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Service Status</h1>
          <p className="text-muted-foreground">Trailblazer platform uptime and incidents.</p>
        </div>

        <Card>
          <CardContent className="p-6 flex items-center gap-3">
            {allClear ? (
              <>
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                <div>
                  <div className="font-semibold">All systems operational</div>
                  <div className="text-sm text-muted-foreground">No active incidents reported.</div>
                </div>
              </>
            ) : (
              <>
                <AlertTriangle className="h-6 w-6 text-amber-500" />
                <div>
                  <div className="font-semibold">{active.length} active incident{active.length === 1 ? "" : "s"}</div>
                  <div className="text-sm text-muted-foreground">We're monitoring closely — updates below.</div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {active.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Active</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {active.map(i => <IncidentRow key={i.id} i={i} />)}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>History</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {past.length === 0 && <p className="text-muted-foreground text-sm">No past incidents.</p>}
            {past.map(i => <IncidentRow key={i.id} i={i} />)}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function IncidentRow({ i }: { i: Incident }) {
  const Icon = i.severity === "maintenance" ? Wrench : AlertTriangle;
  return (
    <div className="rounded border p-3">
      <div className="flex items-start gap-3">
        <Icon className="h-5 w-5 mt-0.5 text-muted-foreground" />
        <div className="flex-1">
          <div className="font-semibold">{i.title}</div>
          <div className="text-xs text-muted-foreground">
            {new Date(i.started_at).toLocaleString()}
            {i.resolved_at && ` — resolved ${new Date(i.resolved_at).toLocaleString()}`}
          </div>
          {i.summary && <p className="text-sm mt-2">{i.summary}</p>}
          <div className="flex gap-2 mt-2 flex-wrap">
            <Badge variant={i.status === "resolved" ? "secondary" : "default"}>{i.status}</Badge>
            <Badge variant="outline">{i.severity}</Badge>
            {i.affected_components.map(c => <Badge key={c} variant="outline">{c}</Badge>)}
          </div>
        </div>
      </div>
    </div>
  );
}
