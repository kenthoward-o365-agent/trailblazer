import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProperty } from "@/contexts/PropertyContext";
import { toast } from "sonner";

export type ChannelCode = "expedia" | "bookingcom";

export interface Channel {
  id: string;
  property_id: string;
  channel_code: ChannelCode;
  is_enabled: boolean;
  hotel_id: string | null;
  currency: string;
  mock_mode: boolean;
  status: "disconnected" | "connected" | "error";
  last_ari_sync_at: string | null;
  last_res_pull_at: string | null;
  last_error: string | null;
}

export const CHANNEL_LABELS: Record<ChannelCode, string> = {
  expedia: "Expedia",
  bookingcom: "Booking.com",
};

export function useChannelManager() {
  const { selectedProperty } = useProperty();
  const propertyId = selectedProperty?.id ?? null;
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    if (!propertyId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("channels")
      .select("*")
      .eq("property_id", propertyId)
      .order("channel_code");
    if (error) {
      toast.error(error.message);
    } else {
      // Ensure a row exists for each channel code
      const existing = new Map((data ?? []).map((c) => [c.channel_code, c]));
      const missing: ChannelCode[] = (["expedia", "bookingcom"] as ChannelCode[]).filter(
        (code) => !existing.has(code)
      );
      if (missing.length) {
        await supabase.from("channels").insert(
          missing.map((code) => ({ property_id: propertyId, channel_code: code }))
        );
        const { data: refetched } = await supabase
          .from("channels").select("*").eq("property_id", propertyId).order("channel_code");
        setChannels((refetched ?? []) as Channel[]);
      } else {
        setChannels((data ?? []) as Channel[]);
      }
    }
    setLoading(false);
  }

  useEffect(() => { refresh(); }, [propertyId]);

  async function updateChannel(id: string, patch: Partial<Channel>) {
    const { error } = await supabase.from("channels").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Channel updated");
    refresh();
  }

  async function testConnection(channelId: string) {
    const { data, error } = await supabase.functions.invoke("channel-test-connection", {
      body: { channel_id: channelId },
    });
    if (error) { toast.error(error.message); return; }
    if ((data as any)?.ok) toast.success((data as any).mocked ? "Connection OK (mock mode)" : "Connection OK");
    else toast.error("Connection failed");
    refresh();
  }

  async function forceAriPush() {
    if (!propertyId) return;
    const { data, error } = await supabase.functions.invoke("channel-ari-push", {
      body: { property_id: propertyId, limit: 500 },
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`ARI push: ${(data as any)?.sent ?? 0} sent, ${(data as any)?.failed ?? 0} failed`);
    refresh();
  }

  return { propertyId, channels, loading, refresh, updateChannel, testConnection, forceAriPush };
}
