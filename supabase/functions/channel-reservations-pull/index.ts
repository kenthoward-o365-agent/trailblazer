import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { channelAdapters, type ChannelCode } from "../_shared/channels/adapters.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  const { data: channels } = await supabase.from("channels").select("*").eq("is_enabled", true);
  let totalPulled = 0;
  for (const ch of channels ?? []) {
    const adapter = channelAdapters[ch.channel_code as ChannelCode];
    const t0 = Date.now();
    const result = await adapter.pullReservations({
      channel_code: ch.channel_code,
      hotel_id: ch.hotel_id,
      credentials_ref: ch.credentials_ref,
      mock_mode: ch.mock_mode,
    });
    const inbound = result.reservations ?? [];
    for (const r of inbound) {
      await supabase.from("channel_reservations_inbox").upsert({
        channel_id: ch.id,
        property_id: ch.property_id,
        external_reservation_id: r.external_reservation_id,
        payload: r as unknown as Record<string, unknown>,
        status: "pending",
      }, { onConflict: "channel_id,external_reservation_id" });
    }
    totalPulled += inbound.length;
    await supabase.from("channels").update({
      last_res_pull_at: new Date().toISOString(),
      status: result.ok ? "connected" : "error",
      last_error: result.ok ? null : result.detail ?? "pull failed",
    }).eq("id", ch.id);
    await supabase.from("channel_sync_log").insert({
      channel_id: ch.id,
      property_id: ch.property_id,
      direction: "inbound",
      action: "reservations_pull",
      status: result.ok ? "success" : "error",
      http_status: result.http_status ?? null,
      duration_ms: Date.now() - t0,
      items_count: inbound.length,
      request_summary: { mocked: result.mocked },
      error: result.ok ? null : result.detail ?? null,
    });
  }

  return new Response(JSON.stringify({ ok: true, pulled: totalPulled }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
