import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CHANNEL_LABELS, type Channel } from "@/hooks/useChannelManager";
import { CheckCircle2, AlertCircle, CircleDot, RefreshCw, Zap } from "lucide-react";
import { useState, useEffect } from "react";

interface Props {
  cm: {
    channels: Channel[];
    loading: boolean;
    updateChannel: (id: string, patch: Partial<Channel>) => void;
    testConnection: (id: string) => void;
    forceAriPush: () => void;
  };
}

export function ChannelsTab({ cm }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={cm.forceAriPush} variant="secondary" className="gap-2">
          <Zap className="h-4 w-4" /> Push ARI now
        </Button>
      </div>
      {cm.channels.map((ch) => (
        <ChannelCard key={ch.id} channel={ch} onUpdate={cm.updateChannel} onTest={cm.testConnection} />
      ))}
    </div>
  );
}

function ChannelCard({
  channel,
  onUpdate,
  onTest,
}: {
  channel: Channel;
  onUpdate: (id: string, patch: Partial<Channel>) => void;
  onTest: (id: string) => void;
}) {
  const [hotelId, setHotelId] = useState(channel.hotel_id ?? "");
  const [currency, setCurrency] = useState(channel.currency);

  useEffect(() => {
    setHotelId(channel.hotel_id ?? "");
    setCurrency(channel.currency);
  }, [channel.id]);

  const StatusIcon = channel.status === "connected" ? CheckCircle2
    : channel.status === "error" ? AlertCircle : CircleDot;
  const statusColor = channel.status === "connected" ? "text-emerald-600"
    : channel.status === "error" ? "text-destructive" : "text-muted-foreground";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle>{CHANNEL_LABELS[channel.channel_code]}</CardTitle>
            <Badge variant={channel.is_enabled ? "default" : "secondary"}>
              {channel.is_enabled ? "Enabled" : "Disabled"}
            </Badge>
            {channel.mock_mode && <Badge variant="outline">Mock mode</Badge>}
          </div>
          <div className={`flex items-center gap-2 ${statusColor}`}>
            <StatusIcon className="h-4 w-4" />
            <span className="text-sm capitalize">{channel.status}</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <Switch
            checked={channel.is_enabled}
            onCheckedChange={(v) => onUpdate(channel.id, { is_enabled: v })}
          />
          <Label>Enable this channel</Label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Hotel / Property ID</Label>
            <Input value={hotelId} onChange={(e) => setHotelId(e.target.value)}
              onBlur={() => hotelId !== (channel.hotel_id ?? "") && onUpdate(channel.id, { hotel_id: hotelId })}
              placeholder="e.g. 123456789" />
          </div>
          <div>
            <Label>Currency</Label>
            <Input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())}
              onBlur={() => currency !== channel.currency && onUpdate(channel.id, { currency })}
              placeholder="USD" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Switch
            checked={channel.mock_mode}
            onCheckedChange={(v) => onUpdate(channel.id, { mock_mode: v })}
          />
          <div>
            <Label>Mock mode</Label>
            <p className="text-xs text-muted-foreground">
              When on, ARI and content pushes are simulated. Turn off once partner credentials are configured and certification is complete.
            </p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row gap-4 text-sm text-muted-foreground">
          <div>Last ARI sync: <span className="text-foreground">{channel.last_ari_sync_at ? new Date(channel.last_ari_sync_at).toLocaleString() : "—"}</span></div>
          <div>Last reservations pull: <span className="text-foreground">{channel.last_res_pull_at ? new Date(channel.last_res_pull_at).toLocaleString() : "—"}</span></div>
        </div>

        {channel.last_error && (
          <div className="text-sm text-destructive">Last error: {channel.last_error}</div>
        )}

        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => onTest(channel.id)} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Test connection
          </Button>
        </div>

        <p className="text-xs text-muted-foreground border-t pt-3">
          To go live: add partner credentials for {CHANNEL_LABELS[channel.channel_code]} (username & password), turn off Mock mode, and complete the OTA's certification test cases visible in the Activity tab.
        </p>
      </CardContent>
    </Card>
  );
}
