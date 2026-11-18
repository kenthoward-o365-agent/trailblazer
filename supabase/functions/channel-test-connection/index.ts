import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { channelAdapters, type ChannelCode } from "../_shared/channels/adapters.ts";
import { z } from "https://esm.sh/zod@3.23.8";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const BodySchema = z.object({ channel_id: z.string().uuid() });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return j({ error: "method_not_allowed" }, 405);

  const parsed = BodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return j({ error: parsed.error.flatten() }, 400);

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: channel } = await supabase.from("channels").select("*").eq("id", parsed.data.channel_id).maybeSingle();
  if (!channel) return j({ error: "channel_not_found" }, 404);

  const adapter = channelAdapters[channel.channel_code as ChannelCode];
  const t0 = Date.now();
  const result = await adapter.testAuth({
    channel_code: channel.channel_code,
    hotel_id: channel.hotel_id,
    credentials_ref: channel.credentials_ref,
    mock_mode: channel.mock_mode,
  });

  await supabase.from("channels").update({
    status: result.ok ? "connected" : "error",
    last_error: result.ok ? null : result.detail ?? "auth failed",
  }).eq("id", channel.id);

  await supabase.from("channel_sync_log").insert({
    channel_id: channel.id,
    property_id: channel.property_id,
    direction: "outbound",
    action: "test_auth",
    status: result.ok ? "success" : "error",
    http_status: result.http_status ?? null,
    duration_ms: Date.now() - t0,
    request_summary: { mocked: result.mocked },
    error: result.ok ? null : result.detail ?? null,
  });

  return j({ ok: result.ok, mocked: result.mocked });
});

function j(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
