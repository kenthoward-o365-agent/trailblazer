import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { CHANNEL_LABELS, type Channel } from "@/hooks/useChannelManager";

export function ActivityLogTab({ channels }: { channels: Channel[] }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const propertyId = channels[0]?.property_id;

  async function load() {
    if (!propertyId) return;
    setLoading(true);
    const { data } = await supabase.from("channel_sync_log")
      .select("*").eq("property_id", propertyId)
      .order("created_at", { ascending: false }).limit(100);
    setLogs(data ?? []);
    setLoading(false);
  }
  useEffect(() => { load(); }, [propertyId]);

  const channelName = (id: string | null) =>
    channels.find((c) => c.id === id) ? CHANNEL_LABELS[channels.find((c) => c.id === id)!.channel_code] : "—";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Activity Log</CardTitle>
          <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Channel</TableHead>
              <TableHead>Direction</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Duration</TableHead>
              <TableHead>Error</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.length === 0 && (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No activity yet</TableCell></TableRow>
            )}
            {logs.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="text-xs whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</TableCell>
                <TableCell>{channelName(l.channel_id)}</TableCell>
                <TableCell>{l.direction}</TableCell>
                <TableCell>{l.action}</TableCell>
                <TableCell>
                  <Badge variant={l.status === "success" ? "default" : "destructive"}>{l.status}</Badge>
                </TableCell>
                <TableCell>{l.items_count ?? "—"}</TableCell>
                <TableCell>{l.duration_ms ? `${l.duration_ms} ms` : "—"}</TableCell>
                <TableCell className="text-xs text-destructive max-w-xs truncate">{l.error ?? ""}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
